<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const video = ref(null)
const stream = ref(null)
const capturedImage = ref(null)
const processedImage = ref(null)

let worker = null

onMounted(() => {
  worker = new Worker('/workers/preprocessWorker.js')
  worker.onmessage = (e) => {
    console.log("Main thread: worker message", e.data)
    processedImage.value = e.data.cleanedImage
  }
  startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
  if (worker) worker.terminate()
})

async function startCamera() {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 2560 },
        height: { ideal: 1440 }
      }

    })
    video.value.srcObject = stream.value
    await video.value.play()
  } catch (err) {
    console.error('Camera error:', err)
  }
}

function stopCamera() {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
  }
}

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

// Logic extracted to Script to access Refs correctly
function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target.result
    processImage(result)
  }
  reader.readAsDataURL(file)

  // IMPORTANT: Reset input so you can select the same file again if needed
  event.target.value = ''
}

function processImage(dataUrl) {
  capturedImage.value = dataUrl
  processedImage.value = null

  worker.postMessage({
    imageDataURL: dataUrl
  })
}
</script>

<template>
  <div class="flex flex-col gap-4 items-center p-4">

    <video ref="video" class="rounded-lg shadow w-full max-w-md bg-black" autoplay playsinline></video>

    <div class="flex flex-col gap-2 w-full max-w-md">
      <button 
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        @click="captureFrame"
      >
        Capture Frame
      </button>

      <input 
        type="file" 
        accept="image/*" 
        class="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
        @change="handleFileUpload"
      />
    </div>

    <div v-if="capturedImage" class="mt-4">
      <p class="text-gray-500 mb-1">Original:</p>
      <img :src="capturedImage" class="rounded shadow w-full max-w-md" />
    </div>

    <div v-if="processedImage" class="mt-4">
      <p class="text-gray-300">Processed Image:</p>
      <img :src="processedImage" class="rounded shadow w-full max-w-md" />
    </div>

    <div v-if="capturedImage && !processedImage" class="mt-4">
       <span class="text-sm text-gray-400 animate-pulse">Processing...</span>
    </div>

  </div>
</template>