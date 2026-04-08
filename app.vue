<script setup>
import '~/assets/main.css'

//register manifest globally for pwa support
useHead({
  link: [
    { rel: 'manifest', href: '/manifest.webmanifest' }
  ]
})

</script>
<template>
  <!--root wrapper with theme colors-->
  <div class="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white transition-colors">
    <NuxtPage />
  </div>
</template>
