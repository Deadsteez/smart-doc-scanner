<script setup>
import CameraCapture from '~/components/CameraCapture.vue'
import AppNavbar from '~/components/AppNavbar.vue'
</script>
<template>
  <div class="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
    <AppNavbar />
    <div class="max-w-3xl mx-auto">
      <CameraCapture />
    </div>
  </div>
</template>