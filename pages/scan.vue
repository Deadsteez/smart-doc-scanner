<script setup>
import CameraCapture from '~/components/CameraCapture.vue'
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Scan Document</h1>
        <p class="text-text-muted text-sm mt-0.5">Capture via camera or upload a PDF/Image</p>
      </div>
      <NuxtLink to="/dashboard" class="text-sky-500 hover:text-sky-400 font-medium text-sm transition-colors flex items-center gap-1">
        <span>←</span> Dashboard
      </NuxtLink>
    </div>
    
    <CameraCapture />
  </div>
</template>