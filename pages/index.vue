<script setup>
import { onMounted, computed } from 'vue'
import { useDocumentStore } from '~/stores/documentStore'

const documentStore = useDocumentStore()

onMounted(async () => {
  await documentStore.loadAll()
})

const documents = computed(() => documentStore.documents)
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">

    <nav class="mb-6 flex gap-4 text-blue-400">
      <NuxtLink to="/">Dashboard</NuxtLink>
      <NuxtLink to="/scan">Scan</NuxtLink>
    </nav>

    <h1 class="text-2xl font-semibold text-white mb-6">
      Scanned Documents
    </h1>

    <div v-if="documents.length === 0" class="text-gray-400">
      No documents scanned yet.
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="doc in documents"
        :key="doc.id"
        class="p-4 bg-gray-900 rounded text-white"
      >
        <p class="text-sm text-gray-400">
          {{ new Date(doc.createdAt).toLocaleString() }}
        </p>
        <pre class="text-sm whitespace-pre-wrap mt-2">
{{ doc.cleanedText }}
        </pre>
      </div>
    </div>

  </div>
</template>
