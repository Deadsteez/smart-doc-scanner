<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { cleanOcrText, isValidOcrOutput } from '~/composables/useOcrCleanup'
import { useDocumentStore } from '~/stores/documentStore'
import { extractCvFeatures } from '~/composables/useCvFeatures'
// NLP worker loaded via Vite's ?worker syntax — handles ES module bundling automatically
import NlpWorker from '~/workers/nlpWorker.js?worker'

// ─── State ────────────────────────────────────────────────────
const videoEl = ref(null)        // owned here — NOT passed as prop
const fileInputEl = ref(null)    // hidden file input for styled upload button
const stream = ref(null)

const capturedImage = ref(null)
const processedImage = ref(null)
const ocrText = ref(null)
const ocrProgress = ref(0)
const ocrConfidence = ref(null)

const cameraError = ref(null)
const captureError = ref(null)
const isSaving = ref(false)
const isSaved = ref(false)
const saveError = ref(null)
const nlpStatus = ref(null)

// ── NLP job queue — prevents race conditions on rapid uploads ─
const nlpReady = ref(false)        // true once models are loaded
const nlpBusy = ref(false)         // true while a job is running
const nlpQueue = []                // pending jobs waiting for worker
const currentNlpJob = ref(null)    // job currently being processed

// ─── Workers ──────────────────────────────────────────────────
let preprocessWorker = null
let ocrWorker = null
let nlpWorker = null       // Transformers.js NER + classifier

// ─── Store (client-only) ──────────────────────────────────────
let documentStore = null

// ─── Lifecycle ────────────────────────────────────────────────
onMounted(() => {
  documentStore = useDocumentStore()

  // OpenCV preprocessing worker
  preprocessWorker = new Worker('/workers/preprocessWorker.js')
  preprocessWorker.onmessage = (e) => {
    if (e.data.cleanedImage) {
      processedImage.value = e.data.cleanedImage
    }
  }
  preprocessWorker.onerror = (err) => console.error('Preprocess worker error:', err)

  // Tesseract OCR worker
  ocrWorker = new Worker('/workers/ocrWorker.js')
  ocrWorker.onmessage = async (e) => {
    const msg = e.data

    if (msg.type === 'progress') {
      ocrProgress.value = Math.floor(msg.progress * 100)
      return
    }

    if (msg.type === 'error') {
      console.error('OCR error:', msg.error)
      ocrProgress.value = 0
      return
    }

    if (msg.type !== 'result') return

    ocrText.value = msg.text
    ocrConfidence.value = msg.confidence ? Math.round(msg.confidence) : null
    ocrProgress.value = 100
    await saveDocument(msg.text)
  }
  ocrWorker.onerror = (err) => {
    console.error('OCR worker error:', err)
    ocrProgress.value = 0
  }

  // ── NLP worker — initialize with ready-state tracking ────────
  // nlpReady gates any postMessage calls until models are loaded.
  // nlpQueue holds jobs that arrived before models were ready.
  nlpWorker = new NlpWorker()

  nlpWorker.onmessage = async (e) => {
    const msg = e.data

    if (msg.type === 'progress') {
      nlpStatus.value = msg.status

      // Models fully loaded — drain any queued jobs
      if (msg.stage === 'ready') {
        nlpReady.value = true
        console.log('[CameraCapture] NLP ready, draining queue:', nlpQueue.length)
        while (nlpQueue.length > 0) {
          const job = nlpQueue.shift()
          nlpWorker.postMessage(job)
        }
      }
      return
    }

    if (msg.type === 'error') {
      console.error('[NLP] Error:', msg.error)
      nlpStatus.value = null
      nlpBusy.value = false
      // Use the job at front of processing slot
      const job = currentNlpJob.value
      if (job) {
        await saveDocumentFallback(job.text, job.cvFeatures)
        currentNlpJob.value = null
      }
      processNextNlpJob()
      return
    }

    if (msg.type === 'result') {
      nlpStatus.value = null
      nlpBusy.value = false
      const job = currentNlpJob.value
      if (job) {
        await saveDocumentWithNlp(job.text, msg.extracted, msg.category)
        currentNlpJob.value = null
      }
      processNextNlpJob()
    }
  }

  nlpWorker.onerror = (err) => {
    console.error('NLP worker error:', err)
    nlpStatus.value = null
    nlpBusy.value = false
    currentNlpJob.value = null
    processNextNlpJob()
  }

  startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
  preprocessWorker?.terminate()
  ocrWorker?.terminate()
  nlpWorker?.terminate()
})

// ─── Camera ───────────────────────────────────────────────────
async function startCamera() {
  cameraError.value = null
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    })
    videoEl.value.srcObject = stream.value
    await videoEl.value.play()
  } catch (err) {
    cameraError.value = err.name === 'NotAllowedError'
      ? 'Camera permission denied. Please allow camera access and refresh.'
      : 'Could not start camera: ' + err.message
  }
}

function stopCamera() {
  stream.value?.getTracks().forEach(t => t.stop())
}

// ─── Capture from camera ──────────────────────────────────────
function captureFrame() {
  captureError.value = null

  if (!videoEl.value) {
    captureError.value = 'Video not ready.'
    return
  }

  if (!stream.value?.active) {
    captureError.value = 'Camera stream not active. Please wait and try again.'
    return
  }

  const width = videoEl.value.videoWidth || videoEl.value.clientWidth
  const height = videoEl.value.videoHeight || videoEl.value.clientHeight

  if (!width || !height) {
    captureError.value = 'Camera not ready yet — please wait a moment and try again.'
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(videoEl.value, 0, 0, width, height)
  processImage(canvas.toDataURL('image/jpeg', 0.92))
}

// ─── File upload ──────────────────────────────────────────────
function triggerFileInput() {
  fileInputEl.value?.click()
}

function handleFileUpload(event) {
  const file = event?.target?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => processImage(e.target.result)
  reader.readAsDataURL(file)
  event.target.value = ''
}

// ─── Shared preprocessing entry ───────────────────────────────
function processImage(dataUrl) {
  capturedImage.value = dataUrl
  processedImage.value = null
  ocrText.value = null
  ocrProgress.value = 0
  isSaved.value = false
  saveError.value = null
  captureError.value = null
  preprocessWorker.postMessage({ imageDataURL: dataUrl })
}

// ─── OCR ──────────────────────────────────────────────────────
function runOCR() {
  if (!processedImage.value) return
  ocrText.value = null
  ocrProgress.value = 0
  ocrConfidence.value = null
  isSaved.value = false
  saveError.value = null
  ocrWorker.postMessage({ image: processedImage.value })
}

// ─── NLP job queue helpers ────────────────────────────────────
function enqueueNlpJob(text, cvFeatures) {
  const job = { text, cvFeatures }

  if (!nlpReady.value) {
    // Models still loading — queue the job, will be drained on 'ready'
    console.log('[CameraCapture] NLP not ready yet, queuing job')
    nlpQueue.push(job)
    return
  }

  if (nlpBusy.value) {
    // Worker busy with another job — queue this one
    console.log('[CameraCapture] NLP busy, queuing job. Queue length:', nlpQueue.length)
    nlpQueue.push(job)
    return
  }

  // Worker ready and free — send immediately
  dispatchNlpJob(job)
}

function dispatchNlpJob(job) {
  nlpBusy.value = true
  currentNlpJob.value = job
  nlpWorker.postMessage({ text: job.text, cvFeatures: job.cvFeatures })
}

function processNextNlpJob() {
  if (nlpQueue.length === 0) return
  const next = nlpQueue.shift()
  dispatchNlpJob(next)
}

// ─── Save pipeline ────────────────────────────────────────────
async function saveDocument(rawText) {
  if (!isValidOcrOutput(rawText)) {
    console.warn('OCR output too noisy, skipping save')
    return
  }
  if (!processedImage.value) return

  isSaving.value = true
  saveError.value = null
  nlpStatus.value = nlpReady.value ? 'Extracting fields...' : 'Loading NLP models...'

  try {
    const cleanedText = cleanOcrText(rawText)
    const cvFeatures = await extractCvFeatures(processedImage.value)

    // Enqueue — handles not-ready and busy states automatically
    enqueueNlpJob(cleanedText, cvFeatures)

  } catch (err) {
    console.error('Pipeline error:', err)
    saveError.value = 'Processing failed: ' + err.message
    isSaving.value = false
    nlpStatus.value = null
  }
}

// Called when NLP worker returns successfully
async function saveDocumentWithNlp(cleanedText, extracted, category) {
  try {
    await documentStore.add({
      createdAt: Date.now(),
      image: processedImage.value,
      ocrText: ocrText.value,
      cleanedText,
      extracted,
      category,
      synced: false,
    })
    isSaved.value = true
  } catch (err) {
    console.error('Save error:', err)
    saveError.value = 'Failed to save: ' + err.message
  } finally {
    isSaving.value = false
    nlpStatus.value = null
  }
}

// Fallback if NLP worker fails — uses regex extraction
async function saveDocumentFallback(cleanedText, cvFeatures) {
  console.warn('[CameraCapture] NLP failed, using regex fallback')
  try {
    const { extractFields } = await import('~/services/extractFields')
    const { classifyDocument } = await import('~/composables/useDocumentClassifier')
    const extracted = extractFields(cleanedText)
    const category = classifyDocument(cleanedText, cvFeatures)

    await documentStore.add({
      createdAt: Date.now(),
      image: processedImage.value,
      ocrText: ocrText.value,
      cleanedText,
      extracted,
      category,
      synced: false,
    })
    isSaved.value = true
  } catch (err) {
    saveError.value = 'Failed to save: ' + err.message
  } finally {
    isSaving.value = false
    nlpStatus.value = null
  }
}

// ─── Clear ────────────────────────────────────────────────────
function clearImages() {
  capturedImage.value = null
  processedImage.value = null
  ocrText.value = null
  ocrProgress.value = 0
  ocrConfidence.value = null
  isSaved.value = false
  saveError.value = null
  captureError.value = null
}
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <div class="p-6 max-w-4xl mx-auto space-y-5">

      <!-- Page header -->
      <div class="mb-2">
        <h1 class="text-2xl font-semibold mb-1">Scan Document</h1>
        <p class="text-gray-400 text-sm">Capture or upload a document to extract and classify data.</p>
      </div>

      <!-- ── Camera Card ── -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

        <!-- Camera error -->
        <div
          v-if="cameraError"
          class="m-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400 flex items-center gap-2"
        >
          <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          {{ cameraError }}
        </div>

        <!-- Video feed -->
        <div class="relative bg-black">
          <video
            ref="videoEl"
            class="w-full max-h-[360px] object-cover block"
            autoplay
            playsinline
            muted
          />
          <!-- Live indicator -->
          <div class="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span class="text-white text-xs font-medium">LIVE</span>
          </div>
        </div>

        <!-- Capture error -->
        <div
          v-if="captureError"
          class="mx-4 mt-4 p-3 bg-yellow-900/30 border border-yellow-800 rounded-lg text-sm text-yellow-400"
        >
          {{ captureError }}
        </div>

        <!-- Action buttons -->
        <div class="p-4 flex gap-3">
          <!-- Capture -->
          <button
            @click="captureFrame"
            class="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Capture Photo
          </button>

          <!-- Upload — styled button, hidden real input -->
          <button
            @click="triggerFileInput"
            class="flex-1 bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 font-semibold px-5 py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 border border-gray-700"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Photo
          </button>

          <input
            ref="fileInputEl"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFileUpload"
          />
        </div>
      </div>

      <!-- ── Saving indicator ── -->
      <div
        v-if="isSaving"
        class="p-4 bg-blue-900/20 border border-blue-800 rounded-xl text-sm text-blue-400 flex items-center gap-3"
      >
        <div class="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
        {{ nlpStatus ?? 'Saving document and syncing to cloud…' }}
      </div>

      <!-- ── Original Image ── -->
      <div v-if="capturedImage" class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div class="flex justify-between items-center mb-3">
          <p class="text-gray-400 text-sm font-medium">Original</p>
          <button
            class="text-red-500 hover:text-red-400 transition text-lg"
            title="Clear image"
            @click="clearImages"
          >
            🗑️
          </button>
        </div>
        <img :src="capturedImage" class="rounded-lg shadow max-h-[300px] mx-auto block" />
      </div>

      <!-- ── Preprocessed Image ── -->
      <div v-if="processedImage" class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p class="text-gray-400 text-sm font-medium mb-3">Preprocessed</p>
        <img :src="processedImage" class="rounded-lg shadow max-h-[300px] mx-auto block mb-4" />
        <button
          class="w-full bg-green-600 hover:bg-green-500 active:scale-95 text-white font-semibold px-4 py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2"
          @click="runOCR"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Run OCR
        </button>
      </div>

      <!-- ── OCR Progress ── -->
      <div
        v-if="ocrProgress > 0 && ocrProgress < 100 && !ocrText"
        class="bg-gray-900 border border-gray-800 rounded-xl p-4"
      >
        <div class="flex items-center gap-3 mb-3">
          <div class="w-4 h-4 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <span class="text-sm text-gray-300">Extracting text from document…</span>
        </div>
        <div class="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            class="h-full bg-blue-500 transition-all duration-300"
            :style="{ width: `${ocrProgress}%` }"
          ></div>
        </div>
        <p class="text-xs text-gray-500 mt-2 text-right">{{ ocrProgress }}%</p>
      </div>

      <!-- ── OCR Output ── -->
      <div v-if="ocrText" class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <p class="font-semibold text-gray-200">OCR Output</p>
          <div class="flex items-center gap-2">
            <span
              v-if="ocrConfidence !== null"
              class="text-xs px-2.5 py-1 rounded-full border"
              :class="ocrConfidence >= 80
                ? 'bg-green-900/30 text-green-400 border-green-800'
                : ocrConfidence >= 60
                  ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800'
                  : 'bg-red-900/30 text-red-400 border-red-800'"
            >
              {{ ocrConfidence }}% confidence
            </span>
            <span class="text-xs px-2.5 py-1 bg-green-900/30 text-green-400 rounded-full border border-green-800">
              Complete
            </span>
          </div>
        </div>
        <pre class="text-sm whitespace-pre-wrap text-gray-300 font-mono leading-relaxed max-h-96 overflow-y-auto bg-black p-4 rounded-lg">{{ ocrText }}</pre>
      </div>

      <!-- ── Save error ── -->
      <div
        v-if="saveError"
        class="p-4 bg-red-900/20 border border-red-800 rounded-xl text-sm text-red-400"
      >
        {{ saveError }}
      </div>

      <!-- ── Success ── -->
      <div
        v-if="isSaved"
        class="p-4 bg-green-900/20 border border-green-800 rounded-xl text-sm text-green-400 flex items-center gap-3"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        <div>
          <p class="font-medium">Document saved!</p>
          <p class="text-xs opacity-75 mt-0.5">Saved locally and syncing to cloud in background.</p>
        </div>
        <NuxtLink
          to="/"
          class="ml-auto text-green-400 hover:underline font-semibold text-sm whitespace-nowrap"
        >
          View Dashboard →
        </NuxtLink>
      </div>

      <!-- ── Sync status ── -->
      <div
        v-if="documentStore?.syncing"
        class="text-xs text-gray-500 text-center flex items-center justify-center gap-1.5"
      >
        <div class="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin"></div>
        Syncing to Supabase…
      </div>
      <div v-if="documentStore?.syncError" class="text-xs text-red-400 text-center">
        Sync failed: {{ documentStore.syncError }} — saved locally, will retry on next load.
      </div>

    </div>
  </div>
</template>