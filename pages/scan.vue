<script setup>
import CameraCapture from '~/components/CameraCapture.vue'

definePageMeta({
  middleware: 'auth'
})
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <div class="p-6 max-w-3xl mx-auto">

      <nav class="mb-6 flex gap-4 text-blue-400 text-sm">
        <NuxtLink to="/" class="hover:underline">Dashboard</NuxtLink>
        <NuxtLink to="/scan" class="hover:underline">Scan</NuxtLink>
      </nav>

      <h1 class="text-2xl font-semibold mb-6">Scan Document</h1>

      <CameraCapture />

    </div>
  </div>
</template>