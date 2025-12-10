<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const video = ref(null)
const stream = ref(null)
const capturedImage = ref(null)

// Start camera
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

// Stop camera
function stopCamera() {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
  }
}

function captureFrame() {
  const canvas = document.createElement('canvas')
  canvas.width = video.value.videoWidth
  canvas.height = video.value.videoHeight

  const ctx = canvas.getContext('2d')
  ctx.drawImage(video.value, 0, 0)

  capturedImage.value = canvas.toDataURL('image/jpeg')

  // later: send this image to preprocessWorker
}

onMounted(startCamera)
onBeforeUnmount(stopCamera)
</script>

<template>
  <div class="flex flex-col gap-4 items-center">

    <video ref="video" class="rounded-lg shadow w-full max-w-md"></video>

    <button 
      class="bg-blue-600 text-white px-4 py-2 rounded-lg"
      @click="captureFrame"
    >
      Capture
    </button>

    <input 
      type="file" 
      accept="image/*" 
      class="mt-2"
      @change="(e) => {
        const file = e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (ev) => {
          capturedImage.value = ev.target.result
        }
        reader.readAsDataURL(file)
      }"
    />
    <div v-if="capturedImage" class="mt-4">
      <img :src="capturedImage" class="rounded shadow w-full max-w-md" />
    </div>

  </div>
</template>
