<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { cleanOcrText, isValidOcrOutput } from '~/composables/useOcrCleanup'
import { useDocumentStore } from '~/stores/documentStore'
import { extractCvFeatures } from '~/composables/useCvFeatures'
import { usePdfProcessor } from '~/composables/usePdfProcessor'
import PdfUploader from '~/components/scanner/PdfUploader.vue'
import NlpWorker from '~/public/workers/nlpWorker.js?worker'
import LanguageSelector from '~/components/LanguageSelector.vue'

const videoEl = ref(null)       
const fileInputEl = ref(null)    
const stream = ref(null)

const capturedImage = ref(null)
const processedImage = ref(null)
const ocrText = ref(null)
const ocrProgress = ref(0)
const ocrConfidence = ref(null)
const selectedLanguage = ref('eng+hin+mar')


const cameraError = ref(null)
const captureError = ref(null)
const isSaving = ref(false)
const isSaved = ref(false)
const saveError = ref(null)
const nlpStatus = ref(null)

const showPdfUploader = ref(false)
const pdfPages = ref([])
const currentPdfPageIndex = ref(0)
const { isPdfFile } = usePdfProcessor()

const nlpReady = ref(false)        
const nlpBusy = ref(false)        
const nlpQueue = []               
const currentNlpJob = ref(null)    

let preprocessWorker = null
let ocrWorker = null
let nlpWorker = null      

let documentStore = null

onMounted(() => {
  documentStore = useDocumentStore()
  
  preprocessWorker = new Worker('/workers/preprocessWorker.js')
  preprocessWorker.onmessage = (e) => {
    if (e.data.cleanedImage) {
      processedImage.value = e.data.cleanedImage
    }
  }
  preprocessWorker.onerror = (err) => console.error('Preprocess worker error:', err)

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

  nlpWorker = new NlpWorker()

  nlpWorker.onmessage = async (e) => {
    const msg = e.data

    if (msg.type === 'progress') {
      nlpStatus.value = msg.status
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

async function startCamera() {
  cameraError.value = null
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    })
    videoEl.value.srcObject = stream.value
    await videoEl.value.play()
  } catch (err) {
    cameraError.value = err.name === 'NotAllowedError'? 'Camera permission denied. Please allow camera access and refresh.': 'Could not start camera: ' + err.message
  }
}

function stopCamera() {
  stream.value?.getTracks().forEach(t => t.stop())
}

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

function triggerFileInput() {
  fileInputEl.value?.click()
}

function handleFileUpload(event) {
  const file = event?.target?.files?.[0]
  if (!file) return
  
  if (isPdfFile(file)) {
    showPdfUploader.value = true
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => processImage(e.target.result)
  reader.readAsDataURL(file)
  event.target.value = ''
}

function handlePdfPagesSelected(pages) {
  pdfPages.value = pages
  currentPdfPageIndex.value = 0
  showPdfUploader.value = false
  
  if (pages.length > 0) {
    processImage(pages[0].image)
  }
}

function handlePdfCancel() {
  showPdfUploader.value = false
  pdfPages.value = []
  currentPdfPageIndex.value = 0
}

function processPreviousPdfPage() {
  if (currentPdfPageIndex.value > 0) {
    currentPdfPageIndex.value--
    processImage(pdfPages.value[currentPdfPageIndex.value].image)
  }
}

function processNextPdfPage() {
  if (currentPdfPageIndex.value < pdfPages.value.length - 1) {
    currentPdfPageIndex.value++
    processImage(pdfPages.value[currentPdfPageIndex.value].image)
  }
}

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

function runOCR() {
  if (!processedImage.value) return
  ocrText.value = null
  ocrProgress.value = 0
  ocrConfidence.value = null
  isSaved.value = false
  saveError.value = null
   ocrWorker.postMessage({ 
    image: processedImage.value,
    language: selectedLanguage.value 
  })
}

function enqueueNlpJob(text, cvFeatures, image) {
  const job = { text, cvFeatures, image }

  if (!nlpReady.value) {
    console.log('[CameraCapture] NLP not ready yet, queuing job')
    nlpQueue.push(job)
    return
  }

  if (nlpBusy.value) {
    console.log('[CameraCapture] NLP busy, queuing job. Queue length:', nlpQueue.length)
    nlpQueue.push(job)
    return
  }

  dispatchNlpJob(job)
}

function dispatchNlpJob(job) {
  nlpBusy.value = true
  currentNlpJob.value = job
  nlpWorker.postMessage({ 
    text: job.text, 
    cvFeatures: job.cvFeatures,
    image: job.image 
  })
}

function processNextNlpJob() {
  if (nlpQueue.length === 0) return
  const next = nlpQueue.shift()
  dispatchNlpJob(next)
}

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

    enqueueNlpJob(cleanedText, cvFeatures, processedImage.value)

  } catch (err) {
    console.error('Pipeline error:', err)
    saveError.value = 'Processing failed: ' + err.message
    isSaving.value = false
    nlpStatus.value = null
  }
}

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

function clearImages() {
  capturedImage.value = null
  processedImage.value = null
  ocrText.value = null
  ocrProgress.value = 0
  ocrConfidence.value = null
  isSaved.value = false
  saveError.value = null
  captureError.value = null
  pdfPages.value = []
  currentPdfPageIndex.value = 0
  showPdfUploader.value = false
}

const showCamera = ref(true)

async function toggleCamera() {
  if (stream.value?.active) {
    stopCamera()
    stream.value = null
    showCamera.value = false
  } else {
    showCamera.value = true
    await startCamera()
  }
}

</script>
<template>
<div class="w-full p-6 max-w-4xl space-y-5">

  <div class="mb-2">
        <p class="text-text-muted text-sm">Capture or upload a document to extract and classify data.</p>
  </div>

  <div class="bg-bg-secondary border border-slate-1/40 rounded-xl overflow-hidden">
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <p class="text-sm font-medium text-text-secondary">Camera</p>
      <button @click="toggleCamera" class="text-xs px-3 py-1.5 rounded-lg border transition-colors" :class="showCamera
          ? 'border-error/40 text-error hover:border-error/70': 'border-success/40 text-success hover:border-success/70'" >{{ showCamera ? '⏹ Turn Off Camera' : '▶ Turn On Camera' }}
      </button>
  </div>

  <div v-if="cameraError" class="m-4 p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error flex items-center gap-2">
    <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
    </svg>
    {{ cameraError }}
  </div>

  <div v-show="showCamera" class="relative bg-bg-primary">
    <video ref="videoEl" class="w-full max-h-[360px] object-cover block" autoplay playsinlinemuted/>
    <div class="absolute top-3 left-3 flex items-center gap-1.5 bg-bg-primary/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
      <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
      <span class="text-white text-xs font-medium">LIVE</span>
    </div>
  </div>

  <div
    v-if="captureError"
    class="mx-4 mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning"
  >
    {{ captureError }}
  </div>

  <div class="p-4 flex gap-3">
    <button
      @click="captureFrame"
      class="flex-1 bg-accent-primary hover:bg-accent-primary/90 active:scale-95 text-white font-semibold px-5 py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-glow-cyan"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      Capture Photo
    </button>
    <button
      @click="triggerFileInput"
      class="flex-1 bg-bg-tertiary hover:bg-bg-elevated active:scale-95 text-text-secondary font-semibold px-5 py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 border border-slate-1/40"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      Upload Photo
    </button>
    <input
      ref="fileInputEl"
      type="file"
      accept="image/*,.pdf,application/pdf"
      class="hidden"
      @change="handleFileUpload"
    />
  </div>
</div>
  <div v-if="showPdfUploader" class="fixed inset-0 bg-bg-primary/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div class="bg-bg-secondary border border-slate-1/40 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-elevated">
      <PdfUploader 
            @pages-selected="handlePdfPagesSelected"
            @cancel="handlePdfCancel"
          />
   </div>
  </div>

  <div v-if="pdfPages.length > 1" class="bg-bg-secondary border border-slate-1/40 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
  <p class="text-text-secondary text-sm font-medium">PDF Page Navigation</p>
  <span class="text-xs text-text-muted">Page {{ currentPdfPageIndex + 1 }} of {{ pdfPages.length }}</span>
  </div>
        
  <div class="flex gap-3">
  <button @click="processPreviousPdfPage":disabled="currentPdfPageIndex === 0" 
  class="flex-1 bg-bg-tertiary hover:bg-bg-elevated disabled:bg-bg-tertiary disabled:text-text-muted/50 text-text-secondary px-4 py-2 rounded-xl transition flex items-center justify-center gap-2"
          >
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
  </svg>
  Previous Page
  </button>
          
  <button @click="processNextPdfPage":disabled="currentPdfPageIndex === pdfPages.length - 1"
            class="flex-1 bg-bg-tertiary hover:bg-bg-elevated disabled:bg-bg-tertiary disabled:text-text-muted/50 text-text-secondary px-4 py-2 rounded-xl transition flex items-center justify-center gap-2"
          >
  Next Page
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
  </svg>
  </button>
  </div>
  </div>

  <div v-if="isSaving" class="p-4 bg-accent-primary/10 border border-accent-primary/30 rounded-xl text-sm text-accent-primary flex items-center gap-3">
    <div class="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin flex-shrink-0"></div>{{ nlpStatus ?? 'Saving document and syncing to cloud…' }}</div>

    <div v-if="capturedImage" class="bg-bg-secondary border border-slate-1/40 rounded-xl p-4">
    <div class="flex justify-between items-center mb-3">
    <p class="text-text-secondary text-sm font-medium">Original</p>

    <button class="text-red-500 hover:text-red-400 transition text-lg" title="Clear image" @click="clearImages">🗑️</button>
    </div>
     <img :src="capturedImage" class="rounded-lg shadow max-h-[300px] mx-auto block" />
</div>

<div v-if="processedImage" class="bg-bg-secondary border border-slate-1/40 rounded-xl p-4">
  <LanguageSelector v-model="selectedLanguage" />
</div>

<div v-if="processedImage" class="bg-bg-secondary border border-slate-1/40 rounded-xl p-4">
<p class="text-text-secondary text-sm font-medium mb-3">Preprocessed</p>
<img :src="processedImage" class="rounded-lg shadow max-h-[300px] mx-auto block mb-4" />

<button class="w-full bg-accent-secondary hover:bg-accent-secondary/90 active:scale-95 text-white font-semibold px-4 py-3 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-glow-teal" @click="runOCR">
  
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
</svg>
          Run OCR
</button>
</div>

<div v-if="ocrProgress > 0 && ocrProgress < 100 && !ocrText" class="bg-bg-secondary border border-slate-1/40 rounded-xl p-4">
  <div class="flex items-center gap-3 mb-3">
    <div class="w-4 h-4 border-[3px] border-accent-primary border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
          <span class="text-sm text-text-secondary">Extracting text from document…</span>
    </div>
    <div class="w-full bg-bg-tertiary rounded-full h-2 overflow-hidden">
        <div class="h-full bg-accent-primary transition-all duration-300":style="{ width: `${ocrProgress}%` }"></div>
    </div>
        <p class="text-xs text-text-muted mt-2 text-right">{{ ocrProgress }}%</p>
    </div>

      <div v-if="ocrText" class="bg-bg-secondary border border-slate-1/40 rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
      <p class="font-semibold text-text-primary">OCR Output</p>
      <div class="flex items-center gap-2">
        <span v-if="ocrConfidence !== null" class="text-xs px-2.5 py-1 rounded-full border":class="ocrConfidence >= 80 ? 'bg-success/15 text-success border-success/30'
                : ocrConfidence >= 60 ? 'bg-warning/15 text-warning border-warning/30': 'bg-error/15 text-error border-error/30'">
        {{ ocrConfidence }}% confidence
        </span>

       <span class="text-xs px-2.5 py-1 bg-success/15 text-success rounded-full border border-success/30">
        Complete
       </span>
      </div>
  </div>
<pre class="text-sm whitespace-pre-wrap text-text-secondary font-mono leading-relaxed max-h-96 overflow-y-auto bg-bg-primary border border-slate-1/30 p-4 rounded-lg">{{ ocrText }}</pre>
</div>

<div v-if="saveError" class="p-4 bg-error/10 border border-error/30 rounded-xl text-sm text-error">{{ saveError }}</div>

<div v-if="isSaved" class="p-4 bg-success/10 border border-success/30 rounded-xl text-sm text-success flex items-center gap-3">
  <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
  </svg>

  <div> <p class="font-medium">Document saved!</p> <p class="text-xs opacity-75 mt-0.5">Saved locally and syncing to cloud in background.</p> </div>
  <NuxtLink to="/" class="ml-auto text-success hover:underline font-semibold text-sm whitespace-nowrap">
  View Dashboard →
  </NuxtLink>
  </div>

<div v-if="documentStore?.syncing" class="text-xs text-text-muted text-center flex items-center justify-center gap-1.5">
<div class="w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin"></div>Syncing to Supabase…</div>

 <div v-if="documentStore?.syncError" class="text-xs text-error text-center">
        Sync failed: {{ documentStore.syncError }} — saved locally, will retry on next load.
  </div>
</div>
</template>