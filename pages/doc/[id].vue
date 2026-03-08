<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDocumentStore } from '~/stores/documentStore'

const route = useRoute()
const documentStore = useDocumentStore()

// renamed from `document` — avoids shadowing the global browser document object
const doc = ref(null)

onMounted(async () => {
  await documentStore.loadAll()
  doc.value = documentStore.documents.find(
    d => String(d.id) === String(route.params.id)
  ) ?? null
})

const extracted = computed(() => doc.value?.extracted || {})

// category is now an object { type, confidence, scores } — not a plain string
const categoryType = computed(() => doc.value?.category?.type ?? 'other')
const categoryConfidence = computed(() =>
  doc.value?.category?.confidence
    ? Math.round(doc.value.category.confidence * 100) + '%'
    : null
)

const categoryClass = computed(() => ({
  invoice: 'bg-green-500/20 text-green-400',
  receipt: 'bg-blue-500/20 text-blue-400',
  other:   'bg-gray-500/20 text-gray-300',
}[categoryType.value] ?? 'bg-gray-500/20 text-gray-300'))
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <div class="p-6 max-w-4xl mx-auto">

      <NuxtLink to="/" class="text-blue-400 hover:underline mb-6 inline-block text-sm">
        ← Back to Dashboard
      </NuxtLink>

      <!-- Loading -->
      <div v-if="!doc" class="text-gray-400 mt-8 text-center">
        Loading document…
      </div>

      <div v-else class="space-y-6 mt-4">

        <!-- Metadata row -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-400">
            {{ new Date(doc.createdAt).toLocaleString() }}
          </span>
          <div class="flex items-center gap-2">
            <span
              class="text-xs px-2.5 py-1 rounded-full uppercase tracking-wide font-medium"
              :class="categoryClass"
            >
              {{ categoryType }}
            </span>
            <span
              v-if="categoryConfidence"
              class="text-xs text-gray-500"
            >
              {{ categoryConfidence }} confidence
            </span>
          </div>
        </div>

        <!-- Scanned Image -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 class="font-semibold mb-3 text-gray-200">Scanned Image</h2>
          <img
            :src="doc.image"
            class="rounded-lg max-w-full shadow-md"
            alt="Scanned document"
          />
        </div>

        <!-- Extracted Fields -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 class="font-semibold mb-3 text-gray-200">Extracted Fields</h2>
          <div class="grid grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <span class="block text-gray-500 text-xs mb-0.5">Vendor</span>
              {{ extracted.vendor || '—' }}
            </div>
            <div>
              <span class="block text-gray-500 text-xs mb-0.5">Date</span>
              {{ extracted.date || '—' }}
            </div>
            <div>
              <span class="block text-gray-500 text-xs mb-0.5">Total</span>
              {{ extracted.total || '—' }}
            </div>
            <div>
              <span class="block text-gray-500 text-xs mb-0.5">Receipt #</span>
              {{ extracted.receiptNumber || '—' }}
            </div>
          </div>
        </div>

        <!-- OCR Text -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 class="font-semibold mb-3 text-gray-200">OCR Text</h2>
          <pre class="bg-black p-4 rounded-lg text-sm whitespace-pre-wrap text-gray-300 font-mono leading-relaxed max-h-96 overflow-y-auto">{{ doc.cleanedText }}</pre>
        </div>

      </div>
    </div>
  </div>
</template>