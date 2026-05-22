<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useDocumentStore } from '~/stores/documentStore'
import '~/assets/main.css'

useHead({
  link: [
    { rel: 'manifest', href: '/manifest.webmanifest' }
  ]
})

onMounted(() => {
  const documentStore = useDocumentStore()
  
  const handleOnline = () => {
    console.log('[App] Network is back online. Syncing pending documents...')
    documentStore.syncPending()
  }

  window.addEventListener('online', handleOnline)

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
  })
})

</script>
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>