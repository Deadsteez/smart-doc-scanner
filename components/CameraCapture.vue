<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { cleanOcrText } from '~/composables/useOcrCleanup'
import { extractFields } from '~/services/extractFields'
import { useDocumentStore } from '~/stores/documentStore'
import { classifyDocument } from '~/composables/useDocumentClassifier'
import { extractCvFeatures } from '~/composables/useCvFeatures'
// --------------------
// State
// --------------------
const video = ref(null)
const stream = ref(null)

const capturedImage = ref(null)
const processedImage = ref(null)

const ocrText = ref(null)
const ocrProgress = ref(0)

// --------------------
// Workers
// --------------------
let preprocessWorker = null
let ocrWorker = null

// --------------------
// Store (CLIENT ONLY)
// --------------------
let documentStore = null

// --------------------
// Lifecycle
// --------------------
onMounted(() => {
  // Initialize Pinia store (client-only)
  documentStore = useDocumentStore()

  // OpenCV preprocessing worker
  preprocessWorker = new Worker('/workers/preprocessWorker.js')
  preprocessWorker.onmessage = (e) => {
    if (e.data.cleanedImage) {
      processedImage.value = e.data.cleanedImage
    }
  }

  // OCR worker
  ocrWorker = new Worker('/workers/ocrWorker.js')
  ocrWorker.onmessage = async (e) => {
    const msg = e.data

    if (msg.type === 'progress') {
      ocrProgress.value = Math.floor(msg.progress * 100)
    }

    if (msg.type === 'result') {
      ocrText.value = msg.text
      ocrProgress.value = 100

    // Normalize + extract (NLP)
    const cleanedText = cleanOcrText(msg.text)
    const extracted = extractFields(cleanedText)

    const safeText = typeof cleanedText === 'string' ? cleanedText : ''

    // --- CV features from image ---
    const cvFeatures = await extractCvFeatures(processedImage.value)

    // --- Multimodal classification (NLP + CV) ---
    const category = classifyDocument(safeText, cvFeatures)

    console.log('Saving document with category:', category)

    documentStore.add({
      createdAt: Date.now(),
      image: processedImage.value ?? '',
      ocrText: msg.text,
      cleanedText: safeText,
      extracted,
      category,
      synced: false
    })

    }


    if (msg.type === 'error') {
      console.error('OCR error:', msg.error)
    }
  }

  startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
  if (preprocessWorker) preprocessWorker.terminate()
  if (ocrWorker) ocrWorker.terminate()
})

// --------------------
// Camera logic
// --------------------
async function startCamera() {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    video.value.srcObject = stream.value
    await video.value.play()
  } catch (err) {
    console.error('Camera error:', err)
  }
}

function stopCamera() {
  if (stream.value) {
    stream.value.getTracks().forEach(t => t.stop())
  }
}

// --------------------
// Capture from camera
// --------------------
function captureFrame() {
  if (!video.value) return

  const canvas = document.createElement('canvas')
  canvas.width = video.value.videoWidth
  canvas.height = video.value.videoHeight

  const ctx = canvas.getContext('2d')
  ctx.drawImage(video.value, 0, 0)

  const dataURL = canvas.toDataURL('image/jpeg')
  processImage(dataURL)
}

// --------------------
// File upload
// --------------------
function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    processImage(e.target.result)
  }
  reader.readAsDataURL(file)

  event.target.value = ''
}

// --------------------
// Shared preprocessing entry
// --------------------
function processImage(dataUrl) {
  capturedImage.value = dataUrl
  processedImage.value = null
  ocrText.value = null
  ocrProgress.value = 0

  preprocessWorker.postMessage({
    imageDataURL: dataUrl
  })
}

// --------------------
// Run OCR
// --------------------
function runOCR() {
  if (!processedImage.value) {
    alert('Preprocess an image first')
    return
  }

  ocrText.value = null
  ocrProgress.value = 0

  ocrWorker.postMessage({
    image: processedImage.value
  })
}
</script>

<template>
  <div class="flex flex-col gap-4 items-center p-4">

    <!-- Camera Preview -->
    <video
      ref="video"
      class="rounded-lg shadow w-full max-w-md bg-black"
      autoplay
      playsinline
    ></video>

    <!-- Controls -->
    <div class="flex flex-col gap-2 w-full max-w-md">
      <button
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        @click="captureFrame"
      >
        Capture Frame
      </button>

      <input
        type="file"
        accept="image/*"
        @change="handleFileUpload"
        class="file:mr-4 file:py-2 file:px-4
               file:rounded-full file:border-0
               file:text-sm file:font-semibold
               file:bg-violet-50 file:text-violet-700
               hover:file:bg-violet-100"
      />
    </div>

    <!-- Original -->
    <div v-if="capturedImage" class="mt-4">
      <p class="text-gray-400 mb-1">Original</p>
      <img :src="capturedImage" class="rounded shadow w-full max-w-md" />
    </div>

    <!-- Processed -->
    <div v-if="processedImage" class="mt-4">
      <p class="text-gray-400 mb-1">Preprocessed</p>
      <img :src="processedImage" class="rounded shadow w-full max-w-md" />

      <button
        class="mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg w-full"
        @click="runOCR"
      >
        Run OCR
      </button>
    </div>

    <!-- OCR Progress -->
    <div v-if="ocrProgress > 0 && !ocrText" class="text-sm text-gray-400">
      OCR Progress: {{ ocrProgress }}%
    </div>

    <!-- OCR Output -->
    <div
      v-if="ocrText"
      class="mt-4 p-4 bg-gray-900 rounded w-full max-w-md text-white"
    >
      <p class="font-semibold mb-2">OCR Output</p>
      <pre class="whitespace-pre-wrap text-sm">{{ ocrText }}</pre>
    </div>

  </div>
</template>
