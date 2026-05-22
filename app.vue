<script setup lang="ts">
import '~/assets/main.css'

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