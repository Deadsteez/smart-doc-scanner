<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDocumentStore } from '~/stores/documentStore'
import { exportDocumentToPDF } from '~/services/exportPdf'

const route = useRoute()
const documentStore = useDocumentStore()

// Avoids shadowing  browser document object
const doc = ref(null)

onMounted(async () => {
  await documentStore.loadAll()
  doc.value = documentStore.documents.find(
    item => String(item.id) === String(route.params.id)
  ) ?? null
})

const extracted = computed(() => doc.value?.extracted || {})
const categoryType = computed(() => doc.value?.category?.type ?? 'other')
const categoryConfidence = computed(() =>
  doc.value?.category?.confidence? Math.round(doc.value.category.confidence * 100) + '%': null
)

const categoryClass = computed(() => ({
  invoice: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/50 dark:border-sky-900/30',
  receipt: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30',
  other:   'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50',
}[categoryType.value] ?? 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50'))

async function deleteDocument() {
  if (!doc.value) return
  if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) return
  await documentStore.remove(doc.value.id)
  navigateTo('/dashboard')
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">

    <NuxtLink
      to="/dashboard"
      class="text-accent-primary hover:text-accent-primary/80 transition-colors mb-6 inline-flex items-center gap-1.5 text-sm font-medium"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Dashboard
    </NuxtLink>

    <div v-if="!doc" class="text-text-muted mt-8 text-center">
      Loading document…
    </div>

    <div v-else class="space-y-6 mt-4">
      <!-- Header row: date, export, category -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <span class="text-sm text-text-muted">
          {{ new Date(doc.createdAt).toLocaleString() }}
        </span>
        <div class="flex items-center gap-3">
          <button
            @click="exportDocumentToPDF(doc)"
            class="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 hover:-translate-y-0.5 shadow-card border border-red-200/50 dark:border-red-900/40"
            title="Export as PDF"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export PDF
          </button>
          <button
            @click="deleteDocument"
            class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 hover:-translate-y-0.5 shadow-card"
            title="Delete document"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862
                   a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6
                   M9 7h6m2 0a2 2 0 00-2-2H9
                   a2 2 0 00-2 2m10 0H5" />
            </svg>
            Delete
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
              class="text-xs text-text-muted"
            >
              {{ categoryConfidence }} confidence
            </span>
          </div>
        </div>
      </div>

      <!-- Scanned Image -->
      <div class="bg-bg-secondary border border-slate-1/50 rounded-xl p-5 shadow-card">
        <h2 class="text-text-primary font-semibold mb-3">Scanned Image</h2>
        <img :src="doc.image" class="rounded-lg max-w-full shadow-elevated" alt="Scanned document" />
      </div>

      <!-- Extracted Fields -->
      <div class="bg-bg-secondary border border-slate-1/50 rounded-xl p-5 shadow-card">
        <h2 class="text-text-primary font-semibold mb-3">Extracted Fields</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <span class="block text-text-muted text-xs mb-0.5">Vendor</span>
            <span class="text-text-secondary text-sm">{{ extracted.vendor || '—' }}</span>
          </div>
          <div>
            <span class="block text-text-muted text-xs mb-0.5">Date</span>
            <span class="text-text-secondary text-sm">{{ extracted.date || '—' }}</span>
          </div>
          <div>
            <span class="block text-text-muted text-xs mb-0.5">Total</span>
            <span class="text-text-secondary text-sm">{{ extracted.total || '—' }}</span>
          </div>
          <div>
            <span class="block text-text-muted text-xs mb-0.5">Receipt #</span>
            <span class="text-text-secondary text-sm">{{ extracted.receiptNumber || '—' }}</span>
          </div>
          <div>
            <span class="block text-text-muted text-xs mb-0.5">Tax</span>
            <span class="text-text-secondary text-sm">{{ extracted.tax || '—' }}</span>
          </div>
          <div>
            <span class="block text-text-muted text-xs mb-0.5">Payment Method</span>
            <span class="text-text-secondary text-sm">{{ extracted.paymentMethod || '—' }}</span>
          </div>
        </div>
      </div>

      <!-- Line Items -->
      <div v-if="extracted.items && extracted.items.length > 0" class="bg-bg-secondary border border-slate-1/50 rounded-xl p-5 shadow-card">
        <h2 class="text-text-primary font-semibold mb-3">Line Items</h2>
        <div class="space-y-2">
          <div
            v-for="(item, index) in extracted.items"
            :key="index"
            class="flex justify-between items-center text-sm border-b border-slate-1/30 pb-2 last:border-0"
          >
            <span class="text-text-secondary">{{ item.description }}</span>
            <span class="text-text-primary font-medium">{{ item.amount }}</span>
          </div>
        </div>
      </div>

      <!-- OCR Text -->
      <div class="bg-bg-secondary border border-slate-1/50 rounded-xl p-5 shadow-card">
        <h2 class="text-text-primary font-semibold mb-3">OCR Text</h2>
        <pre class="bg-bg-primary  p-4 rounded-lg text-sm whitespace-pre-wrap text-text-secondary font-mono leading-relaxed max-h-96 overflow-y-auto">{{ doc.cleanedText }}</pre>
      </div>
    </div>
  </div>
</template>