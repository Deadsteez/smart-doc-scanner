<script setup>
import { ref } from 'vue'

// The video ref lives HERE inside this component.
// Parent accesses it via: const previewRef = ref(null) → previewRef.value.videoEl
const videoEl = ref(null)

defineEmits(['capture'])

// Expose videoEl so the parent can do:
//   const preview = ref(null)
//   <CameraPreview ref="preview" />
//   preview.value.videoEl  ← works correctly
defineExpose({ videoEl })
</script>

<template>
  <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
    <div class="p-4">
      <div class="relative mb-4 bg-gray-100 dark:bg-black rounded-lg overflow-hidden">
        <video
          ref="videoEl"
          class="w-full max-h-[360px] object-cover"
          autoplay
          playsinline
          muted
        />
      </div>

      <button
        @click="$emit('capture')"
        class="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-5 py-3 rounded-lg transition-colors duration-150 flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Capture Photo
      </button>
    </div>
  </div>
</template>