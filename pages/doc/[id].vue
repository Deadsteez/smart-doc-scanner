<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDocumentStore } from '~/stores/documentStore'
import { exportDocumentToPDF } from '~/services/exportPdf'
import { getCategoryLabel } from '~/composables/useDocumentClassifier'

const route = useRoute()
const documentStore = useDocumentStore()

const doc = ref(null)

onMounted(async () => {
  await documentStore.loadAll()
  doc.value = documentStore.documents.find(
    item => String(item.id) === String(route.params.id)
  ) ?? null
})

const extracted   = computed(() => doc.value?.extracted || {})
const categoryType = computed(() => doc.value?.category?.type ?? 'other')
const categoryLabel = computed(() => getCategoryLabel(categoryType.value))
const categoryConfidence = computed(() =>
  doc.value?.category?.confidence
    ? Math.round(doc.value.category.confidence * 100) + '%'
    : null
)

const patternType = computed(() => doc.value?.category?.patternType)

const categoryClass = computed(() => ({
  invoice:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  receipt:       'bg-sky-500/15 text-sky-400 border-sky-500/30',
  bank_statement:'bg-blue-500/15 text-blue-400 border-blue-500/30',
  payment_slip:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  utility_bill:  'bg-violet-500/15 text-violet-400 border-violet-500/30',
  tax_document:  'bg-rose-500/15 text-rose-400 border-rose-500/30',
  contract:      'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  other:         'bg-slate-500/15 text-slate-400 border-slate-500/30',
}[categoryType.value] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30'))

const categoryIcon = computed(() => ({
  invoice:       '🧾',
  receipt:       '🛒',
  bank_statement:'🏦',
  payment_slip:  '💳',
  utility_bill:  '⚡',
  tax_document:  '📋',
  contract:      '📝',
  other:         '📄',
}[categoryType.value] ?? '📄'))

// ─── Category-specific extra fields ──────────────────────────────────────────

const coreFields = computed(() => [
  { key: 'vendor',        label: 'Vendor / Company' },
  { key: 'date',          label: 'Date' },
  { key: 'total',         label: 'Total Amount', currency: true },
  { key: 'tax',           label: 'Tax' },
  { key: 'receiptNumber', label: 'Reference No.' },
  { key: 'paymentMethod', label: 'Payment Method' },
  { key: 'currency',      label: 'Currency' },
].filter(f => extracted.value[f.key]))

const categoryFields = computed(() => {
  const e = extracted.value
  const cat = categoryType.value
  const maps = {
    invoice: [
      { key: 'invoiceNumber', label: 'Invoice No.' },
      { key: 'gstin',         label: 'GSTIN' },
      { key: 'poNumber',      label: 'PO Number' },
      { key: 'dueDate',       label: 'Due Date' },
    ],
    bank_statement: [
      { key: 'accountNumber',  label: 'Account No.' },
      { key: 'openingBalance', label: 'Opening Balance' },
      { key: 'closingBalance', label: 'Closing Balance' },
      { key: 'ifsc',           label: 'IFSC Code' },
      { key: 'statementPeriod', label: 'Statement Period' },
    ],
    utility_bill: [
      { key: 'consumerNumber', label: 'Consumer/Meter No.' },
      { key: 'billingPeriod',  label: 'Billing Period' },
      { key: 'unitsConsumed',  label: 'Units Consumed' },
    ],
    tax_document: [
      { key: 'pan',            label: 'PAN' },
      { key: 'assessmentYear', label: 'Assessment Year' },
      { key: 'taxAmount',      label: 'Tax Amount' },
    ],
    payment_slip: [
      { key: 'utrNumber',     label: 'UTR No.' },
      { key: 'bankReference', label: 'Bank Reference' },
      { key: 'transferMode',  label: 'Transfer Mode' },
    ],
  }
  return (maps[cat] ?? []).filter(f => e[f.key])
})

// ─── AI confidence breakdown ──────────────────────────────────────────────────

const scoreEntries = computed(() => {
  const scores = doc.value?.category?.scores
  if (!scores) return []
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([type, score]) => ({
      type,
      label: getCategoryLabel(type),
      score,
      pct: Math.round(score * 100),
    }))
    .filter(e => e.pct > 0)
    .slice(0, 5)
})

const maxScore = computed(() =>
  scoreEntries.value.length > 0 ? scoreEntries.value[0].score : 1
)
</script>

<template>
  <div class="p-4 sm:p-6 max-w-4xl mx-auto">

    <NuxtLink to="/dashboard"
      class="text-sky-400 hover:text-sky-300 transition-colors mb-6 inline-flex items-center gap-1.5 text-sm font-medium">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Dashboard
    </NuxtLink>

    <div v-if="!doc" class="text-slate-500 mt-8 text-center">
      Loading document…
    </div>

    <div v-else class="space-y-5 mt-4">

      <!-- ─── Header row ──────────────────────────────────────────────────── -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <span class="text-sm text-slate-500">
          {{ new Date(doc.createdAt).toLocaleString() }}
        </span>
        <div class="flex items-center gap-3 flex-wrap">
          <button @click="exportDocumentToPDF(doc)"
            class="bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border border-rose-500/30">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Export PDF
          </button>
          <span class="text-sm px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5" :class="categoryClass">
            {{ categoryIcon }} {{ categoryLabel }}
          </span>
          <span v-if="categoryConfidence" class="text-xs text-slate-500">
            {{ categoryConfidence }} confidence
          </span>
        </div>
      </div>

      <!-- ─── Document image ─────────────────────────────────────────────── -->
      <div class="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
        <h2 class="text-slate-200 font-semibold mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Scanned Image
        </h2>
        <img :src="doc.image" class="rounded-xl max-w-full shadow-xl mx-auto block" alt="Scanned document" />
      </div>

      <!-- ─── Core extracted fields ─────────────────────────────────────── -->
      <div class="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
        <h2 class="text-slate-200 font-semibold mb-4 flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Extracted Fields
        </h2>

        <div v-if="coreFields.length > 0" class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          <div v-for="field in coreFields" :key="field.key"
            class="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
            <span class="block text-slate-500 text-[10px] uppercase tracking-wider mb-1">{{ field.label }}</span>
            <span class="text-slate-200 text-sm font-medium">
              {{ field.currency && extracted.currency ? extracted.currency + ' ' : '' }}{{ extracted[field.key] }}
            </span>
          </div>
        </div>
        <div v-else class="text-slate-500 text-sm">No fields extracted yet.</div>

        <!-- Category-specific extra fields -->
        <div v-if="categoryFields.length > 0">
          <div class="text-xs text-slate-500 uppercase tracking-wider mb-3 mt-4 border-t border-slate-700/40 pt-4">
            {{ categoryLabel }} Details
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div v-for="field in categoryFields" :key="field.key"
              class="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30">
              <span class="block text-slate-500 text-[10px] uppercase tracking-wider mb-1">{{ field.label }}</span>
              <span class="text-slate-300 text-sm font-mono">{{ extracted[field.key] }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Line items ────────────────────────────────────────────────── -->
      <div v-if="extracted.items && extracted.items.length > 0"
        class="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
        <h2 class="text-slate-200 font-semibold mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Line Items
        </h2>
        <div class="divide-y divide-slate-700/40">
          <div v-for="(item, index) in extracted.items" :key="index"
            class="flex justify-between items-center py-2.5 text-sm">
            <span class="text-slate-300">{{ item.description }}</span>
            <span class="text-slate-200 font-semibold tabular-nums">
              {{ extracted.currency ? extracted.currency + ' ' : '' }}{{ item.amount }}
            </span>
          </div>
        </div>
        <div v-if="extracted.total"
          class="flex justify-between items-center pt-3 mt-2 border-t border-slate-600/60">
          <span class="text-slate-400 text-sm font-semibold">Total</span>
          <span class="text-slate-100 font-bold tabular-nums">
            {{ extracted.currency ? extracted.currency + ' ' : '' }}{{ extracted.total }}
          </span>
        </div>
      </div>

      <!-- ─── AI Classification breakdown ──────────────────────────────── -->
      <div class="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
        <h2 class="text-slate-200 font-semibold mb-4 flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI Classification Scores
          <span v-if="patternType && patternType !== 'other'"
            class="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-normal">
            Pattern: {{ patternType }}
          </span>
        </h2>
        <div v-if="scoreEntries.length > 0" class="space-y-2.5">
          <div v-for="entry in scoreEntries" :key="entry.type" class="flex items-center gap-3">
            <span class="text-xs text-slate-400 w-28 truncate">{{ entry.label }}</span>
            <div class="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                :class="entry.type === categoryType ? 'bg-sky-500' : 'bg-slate-600'"
                :style="{ width: `${Math.round((entry.score / maxScore) * 100)}%` }">
              </div>
            </div>
            <span class="text-xs text-slate-500 w-12 text-right tabular-nums">{{ entry.pct }}%</span>
          </div>
        </div>
        <div v-else class="text-slate-500 text-sm">Classification scores not available.</div>
      </div>

      <!-- ─── OCR Text ───────────────────────────────────────────────────── -->
      <div class="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
        <h2 class="text-slate-200 font-semibold mb-3 flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          OCR Text
        </h2>
        <pre
          class="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm whitespace-pre-wrap text-slate-400 font-mono leading-relaxed max-h-96 overflow-y-auto">{{ doc.cleanedText || '—' }}</pre>
      </div>

    </div>
  </div>
</template>