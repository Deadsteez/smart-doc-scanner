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
  <div class="min-h-screen bg-black text-white">
    <div class="p-6 max-w-4xl mx-auto">

      

      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-semibold mb-1">Scan Document</h1>
        <p class="text-gray-400 text-sm">
          Capture or upload a document to extract and classify data.
        </p>
      </div>

      <!-- Camera / Upload Card -->
      <div class="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">

        <!-- Camera Preview -->
        <div class="mb-4">
          <video
            ref="video"
            class="rounded-lg w-full max-h-[360px] object-cover bg-black"
            autoplay
            playsinline
          ></video>
        </div>

        <!-- Controls -->
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            @click="captureFrame"
          >
            Capture Photo
          </button>

          <input
            type="file"
            accept="image/*"
            @change="handleFileUpload"
            class="file:mr-4 file:py-2 file:px-4
                   file:rounded file:border-0
                   file:text-sm file:bg-gray-800
                   file:text-gray-200 hover:file:bg-gray-700"
          />
        </div>
      </div>

      <!-- Original Image -->
      <div v-if="capturedImage" class="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        <div class="flex justify-between items-center mb-2">
          <p class="text-gray-400 text-sm">Original</p>

          <!-- Delete / Reset -->
          <button
            class="text-red-500 hover:text-red-400 text-lg"
            title="Clear image"
            @click="capturedImage = null; processedImage = null; ocrText = null"
          >
            🗑️
          </button>
        </div>

        <img
          :src="capturedImage"
          class="rounded shadow max-h-[300px] mx-auto"
        />
      </div>

      <!-- Preprocessed Image -->
      <div v-if="processedImage" class="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        <p class="text-gray-400 text-sm mb-2">Preprocessed</p>

        <img
          :src="processedImage"
          class="rounded shadow max-h-[300px] mx-auto mb-4"
        />

        <button
          class="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
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
        class="bg-gray-900 border border-gray-800 rounded-lg p-4 mt-6"
      >
        <p class="font-semibold mb-2">OCR Output</p>
        <pre class="text-sm whitespace-pre-wrap text-gray-300">
{{ ocrText }}
        </pre>
      </div>

    </div>
  </div>
</template>
