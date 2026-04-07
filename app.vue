<script setup>
import '~/assets/main.css'


useHead({
  link: [
    { rel: 'manifest', href: '/manifest.webmanifest' }
  ]
})
</script>
<template>
  <div class="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white transition-colors">
    <NuxtPage />
  </div>
</template>
