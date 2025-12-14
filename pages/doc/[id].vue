<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDocumentStore } from '~/stores/documentStore'

const route = useRoute()
const documentStore = useDocumentStore()

const document = ref(null)

onMounted(async () => {
  await documentStore.loadAll()
  document.value = documentStore.documents.find(
    d => String(d.id) === route.params.id
  )
})

const extracted = computed(() => document.value?.extracted || {})
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto text-white">

    <NuxtLink to="/" class="text-blue-400 mb-4 inline-block">
      ← Back to Dashboard
    </NuxtLink>

    <div v-if="!document" class="text-gray-400">
      Loading document…
    </div>

    <div v-else class="space-y-6">

      <!-- Metadata -->
      <div class="text-sm text-gray-400">
        {{ new Date(document.createdAt).toLocaleString() }}
      </div>

      <!-- Image -->
      <div>
        <h2 class="font-semibold mb-2">Scanned Image</h2>
        <img
          :src="document.image"
          class="rounded shadow max-w-full"
        />
      </div>

      <!-- Extracted Fields -->
      <div>
        <h2 class="font-semibold mb-2">Extracted Fields</h2>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Vendor:</strong> {{ extracted.vendor || '—' }}</div>
          <div><strong>Date:</strong> {{ extracted.date || '—' }}</div>
          <div><strong>Total:</strong> {{ extracted.total || '—' }}</div>
          <div><strong>Receipt #:</strong> {{ extracted.receiptNumber || '—' }}</div>
        </div>
      </div>

      <!-- OCR Text -->
      <div>
        <h2 class="font-semibold mb-2">OCR Text</h2>
        <pre class="bg-gray-900 p-4 rounded text-sm whitespace-pre-wrap">
{{ document.cleanedText }}
        </pre>
      </div>

    </div>
  </div>
</template>
