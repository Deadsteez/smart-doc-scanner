<script setup>
import CameraCapture from '~/components/CameraCapture.vue'
</script>

<template>

    <nav class="mb-6 flex gap-4 text-blue-400">
    <NuxtLink to="/">Dashboard</NuxtLink>
    <NuxtLink to="/scan">Scan</NuxtLink>
    </nav>

  <div class="p-6 max-w-3xl mx-auto">
    <h1 class="text-2xl font-semibold text-white mb-6">
      Scan Document
    </h1>

    <CameraCapture />
  </div>
</template>
