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
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
