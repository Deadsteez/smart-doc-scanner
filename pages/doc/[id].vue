<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDocumentStore } from '~/stores/documentStore'
import { exportDocumentToPDF } from '~/services/exportPdf'

const route = useRoute()
const documentStore = useDocumentStore()

//avoids shadowing the global browser document object
const doc = ref(null)

onMounted(async () => {
  await documentStore.loadAll()
  doc.value = documentStore.documents.find(
    d => String(d.id) === String(route.params.id)
  ) ?? null
})

const extracted = computed(() => doc.value?.extracted || {})

// category is an object { type, confidence, scores } 
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
  <div class="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
    <AppNavbar />
    <div class="p-6 max-w-4xl mx-auto">

      <NuxtLink to="/" class="text-blue-400 hover:underline mb-6 inline-block text-sm">
        ← Back to Dashboard
      </NuxtLink>

      <!-- Loading -->
      <div v-if="!doc" class="text-gray-600 dark:text-gray-400 mt-8 text-center">
        Loading document…
      </div>

      <div v-else class="space-y-6 mt-4">

       <!-- Metadata row -->
<div class="flex items-center justify-between">
  <span class="text-sm text-gray-600 dark:text-gray-400">
    {{ new Date(doc.createdAt).toLocaleString() }}
  </span>
  <div class="flex items-center gap-3">
    <button
      @click="exportDocumentToPDF(doc)"
      class="bg-red-600/90 hover:bg-red-600 px-3 py-1.5 rounded text-xs transition flex items-center gap-1.5 text-white"
      title="Export as PDF"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      Export PDF
    </button>
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
</div>


        <!-- Scanned Image -->
        <div class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-200">Scanned Image</h2>
          <img
            :src="doc.image"
            class="rounded-lg max-w-full shadow-md"
            alt="Scanned document"
          />
        </div>

        <!-- Extracted Fields -->
        <div class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-200">Extracted Fields</h2>
          <div class="grid grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-300">
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
            <div>
              <span class="block text-gray-500 text-xs mb-0.5">Tax</span>
              {{ extracted.tax || '—' }}
            </div>
            <div>
              <span class="block text-gray-500 text-xs mb-0.5">Payment Method</span>
              {{ extracted.paymentMethod || '—' }}
            </div>
          </div>
        </div>
              <!-- Line Items -->
      <div v-if="extracted.items && extracted.items.length > 0" class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-200">Line Items</h2>
        <div class="space-y-2">
          <div 
            v-for="(item, index) in extracted.items" 
            :key="index"
            class="flex justify-between items-center text-sm border-b border-gray-200 dark:border-gray-800 pb-2 last:border-0"
          >
            <span class="text-gray-700 dark:text-gray-300">{{ item.description }}</span>
            <span class="text-gray-900 dark:text-gray-100 font-medium">{{ item.amount }}</span>
          </div>
        </div>
      </div>

        <!-- OCR Text -->
        <div class="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h2 class="font-semibold mb-3 text-gray-900 dark:text-gray-200">OCR Text</h2>
          <pre class="bg-gray-100 dark:bg-black p-4 rounded-lg text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-300 font-mono leading-relaxed max-h-96 overflow-y-auto">{{ doc.cleanedText }}</pre>
        </div>

      </div>
    </div>
  </div>
</template>