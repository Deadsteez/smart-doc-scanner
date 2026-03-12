<script setup>
import CameraCapture from '~/components/CameraCapture.vue'
import AppNavbar from '~/components/AppNavbar.vue'
</script>

<template>
  <div class="min-h-screen bg-black text-white flex flex-col">
    <AppNavbar />
    <div class="flex-1 w-full">
      <CameraCapture />
    </div>
  </div>
</template>