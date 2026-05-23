<script setup>
import { onMounted, computed, ref, watch } from 'vue'
import { useDocumentStore } from '~/stores/documentStore'
import { exportDocumentsToCSV } from '~/services/exportCsv'
import { exportMultipleDocumentsToPDF } from '~/services/exportPdf'
import { useSemanticEngine } from '~/composables/useSemanticEngine'
import { getCategoryLabel } from '~/composables/useDocumentClassifier'
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS } from '~/services/vendorIntelligence'
import ExpenseInsights from '~/components/ExpenseInsights.vue'

const documentStore = useDocumentStore()
const { search, isSearching, isEmbedderReady, parsedQuery, queryExplanation } = useSemanticEngine()

const semanticQuery    = ref('')
const selectedCategory = ref('all')
const filterStartDate  = ref('')
const filterEndDate    = ref('')
const filterMinAmount  = ref(null)
const filterMaxAmount  = ref(null)

const showInsights    = ref(false)
const searchDebounce  = ref(null)
const searchResults   = ref(null)   // null = no search active

onMounted(async () => {
  await documentStore.loadAll()
})

watch(semanticQuery, (q) => {
  clearTimeout(searchDebounce.value)
  if (!q.trim()) { searchResults.value = null; return }
  searchDebounce.value = setTimeout(async () => {
    searchResults.value = await search(q.trim(), documentStore.documents)
  }, 400)
})

const documents = computed(() => {
  let docs = searchResults.value
    ? searchResults.value.map(r => r.doc)
    : documentStore.sortedDocuments

  if (selectedCategory.value !== 'all') {
    docs = docs.filter(d => d.category?.type === selectedCategory.value)
  }

  if (filterStartDate.value) {
    const start = new Date(filterStartDate.value).getTime()
    docs = docs.filter(d => d.createdAt >= start)
  }
  if (filterEndDate.value) {
    const end = new Date(filterEndDate.value).getTime() + 86400000 - 1
    docs = docs.filter(d => d.createdAt <= end)
  }

  if (filterMinAmount.value !== null && filterMinAmount.value !== '') {
    const min = parseFloat(filterMinAmount.value)
    if (!isNaN(min)) {
      docs = docs.filter(d => {
        if (!d.extracted?.total) return false
        const val = parseFloat(String(d.extracted.total).replace(/[,\s]/g, ''))
        return !isNaN(val) && val >= min
      })
    }
  }
  if (filterMaxAmount.value !== null && filterMaxAmount.value !== '') {
    const max = parseFloat(filterMaxAmount.value)
    if (!isNaN(max)) {
      docs = docs.filter(d => {
        if (!d.extracted?.total) return false
        const val = parseFloat(String(d.extracted.total).replace(/[,\s]/g, ''))
        return !isNaN(val) && val <= max
      })
    }
  }

  return docs
})

const totalDocuments = computed(() => documentStore.documents.length)

function categoryClass(category) {
  return (
    {
      receipt:        'bg-sky-500/15 text-sky-400  border-sky-500/25',
      invoice:        'bg-emerald-500/15 text-emerald-400  border-emerald-500/25',
      bank_statement: 'bg-blue-500/15 text-blue-400  border-blue-500/25',
      payment_slip:   'bg-amber-500/15 text-amber-400  border-amber-500/25',
      utility_bill:   'bg-violet-500/15 text-violet-400  border-violet-500/25',
      tax_document:   'bg-rose-500/15 text-rose-400  border-rose-500/25',
      contract:       'bg-cyan-500/15 text-cyan-400  border-cyan-500/25',
      other:          'bg-slate-2/15 text-text-secondary  border-slate-500/25',
      uncategorized:  'bg-slate-2/15 text-text-secondary  border-slate-500/25',
    }[category?.type] || 'bg-slate-2/15 text-text-secondary  border-slate-500/25'
  )
}

function expenseCategoryBadge(doc) {
  const cat = doc.expenseCategory
  if (!cat || cat === 'other') return null
  return {
    label: EXPENSE_CATEGORY_LABELS[cat]?.split(' ').slice(1).join(' ') ?? cat,
    emoji: EXPENSE_CATEGORY_LABELS[cat]?.split(' ')[0] ?? '📦',
    color: EXPENSE_CATEGORY_COLORS[cat] ?? '#475569',
  }
}

function getSemScore(doc) {
  if (!searchResults.value) return null
  const r = searchResults.value.find(r => r.doc.id === doc.id)
  return r ? Math.round(r.score * 100) : null
}

function deleteDoc(id, event) {
  event.preventDefault()
  event.stopPropagation()
  if (!confirm('Delete this document?')) return
  documentStore.remove(id)
}

function clearSearch() {
  semanticQuery.value = ''
  searchResults.value = null
}

function clearFilters() {
  selectedCategory.value = 'all'
  filterStartDate.value  = ''
  filterEndDate.value    = ''
  filterMinAmount.value  = null
  filterMaxAmount.value  = null
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-7xl mx-auto font-sans animate-fade-in">

    <!-- ─── Header ───────────────────────────────────────────────────────── -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Scanned Documents</h1>
        <p class="text-text-muted text-sm mt-0.5">
          {{ totalDocuments }} scanned · AI-powered semantic search
        </p>
      </div>

      <div class="flex gap-2 flex-wrap items-center">
        <!-- Insights toggle -->
        <button
          class="px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border"
          :class="showInsights
            ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
            : 'bg-bg-tertiary text-text-secondary border-slate-1 hover:border-violet-500/40 hover:text-violet-300'"
          @click="showInsights = !showInsights"
        >
          ✨ {{ showInsights ? 'Hide' : 'Insights' }}
        </button>

        <!-- Export CSV -->
        <button
          class="bg-success text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-[0_4px_14px_0_rgba(16,185,129,0.2)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] active:scale-[0.98]"
          @click="exportDocumentsToCSV(documents)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>

        <!-- Export PDF -->
        <button
          class="bg-error text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-[0_4px_14px_0_rgba(239,68,68,0.2)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.4)] active:scale-[0.98]"
          @click="exportMultipleDocumentsToPDF(documents)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Export PDF
        </button>

        <!-- Scan shortcut -->
        <NuxtLink
          to="/scan"
          class="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/25"
        >
          + Scan
        </NuxtLink>
      </div>
    </div>

    <!-- ─── Expense Insights panel ───────────────────────────────────────── -->
    <div v-if="showInsights" class="mb-6">
      <ExpenseInsights :documents="documentStore.documents" />
    </div>

    <!-- ─── Semantic Search Bar ──────────────────────────────────────────── -->
    <div class="mb-5 space-y-2">
      <div class="relative">
        <!-- AI status icon -->
        <div class="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
          <span class="text-base" :class="isEmbedderReady ? 'text-violet-400' : 'text-text-muted'">
            {{ isSearching ? '⏳' : '✨' }}
          </span>
        </div>

        <input
          v-model="semanticQuery"
          placeholder="Search semantically… e.g. 'petrol expenses last month' or 'Swiggy bills above ₹500'"
          class="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-bg-secondary  text-text-primary placeholder-slate-600 text-sm transition-all outline-none"
          :class="semanticQuery
            ? 'border-violet-500/60 ring-2 ring-violet-500/15 shadow-lg shadow-violet-500/10'
            : 'border-slate-1/60 hover:border-slate-2 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/15'"
        />

        <!-- Clear search -->
        <button
          v-if="semanticQuery"
          @click="clearSearch"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1"
        >
          ✕
        </button>
      </div>

      <!-- Parsed query explanation -->
      <div
        v-if="semanticQuery && queryExplanation"
        class="flex items-center gap-2 px-4 py-2 bg-violet-500/8  border-violet-500/20 rounded-xl text-xs text-violet-300 flex-wrap"
      >
        <span class="font-semibold text-violet-400">AI understood:</span>
        <span>{{ queryExplanation }}</span>
        <span v-if="searchResults" class="ml-auto text-violet-400/70">
          {{ searchResults.length }} results
        </span>
      </div>

      <!-- Embedder loading notice -->
      <div
        v-else-if="!isEmbedderReady && totalDocuments > 0"
        class="flex items-center gap-2 px-4 py-2 bg-bg-tertiary/60  border-slate-1/40 rounded-xl text-xs text-text-muted"
      >
        <div class="w-3 h-3  border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        Loading semantic AI model… search will be available shortly
      </div>
    </div>

    <!-- ─── Filter bar ────────────────────────────────────────────────────── -->
    <div class="flex gap-3 flex-wrap mb-5 items-center bg-bg-secondary/50 p-3 rounded-2xl  border-slate-1/50">

      <!-- Category -->
      <select
        v-model="selectedCategory"
        class="px-3.5 py-2 rounded-xl bg-bg-secondary  border-slate-1 text-text-secondary text-sm focus:border-violet-500/60 focus:outline-none transition-all"
      >
        <option value="all">All Types</option>
        <option value="receipt">🛒 Receipt</option>
        <option value="invoice">🧾 Invoice</option>
        <option value="bank_statement">🏦 Bank Statement</option>
        <option value="payment_slip">💳 Payment Slip</option>
        <option value="utility_bill">⚡ Utility Bill</option>
        <option value="tax_document">📋 Tax Document</option>
        <option value="contract">📝 Contract</option>
        <option value="other">📄 Other</option>
        <option value="uncategorized">📄 Uncategorized</option>
      </select>

      <!-- Date range -->
      <div class="flex items-center gap-1.5">
        <span class="text-text-muted text-xs font-medium pl-1">Date:</span>
        <input
          type="date"
          v-model="filterStartDate"
          class="px-3 py-1.5 rounded-xl bg-bg-secondary  border-slate-1 text-text-secondary text-sm focus:border-violet-500/60 focus:outline-none transition-all"
        />
        <span class="text-text-muted text-xs">to</span>
        <input
          type="date"
          v-model="filterEndDate"
          class="px-3 py-1.5 rounded-xl bg-bg-secondary  border-slate-1 text-text-secondary text-sm focus:border-violet-500/60 focus:outline-none transition-all"
        />
      </div>

      <!-- Amount range -->
      <div class="flex items-center gap-1.5">
        <span class="text-text-muted text-xs font-medium pl-1">Amount:</span>
        <input
          type="number"
          v-model="filterMinAmount"
          placeholder="Min"
          class="w-20 px-3 py-1.5 rounded-xl bg-bg-secondary  border-slate-1 text-text-secondary text-sm focus:border-violet-500/60 focus:outline-none transition-all placeholder:text-text-muted/50"
        />
        <span class="text-text-muted text-xs">-</span>
        <input
          type="number"
          v-model="filterMaxAmount"
          placeholder="Max"
          class="w-20 px-3 py-1.5 rounded-xl bg-bg-secondary  border-slate-1 text-text-secondary text-sm focus:border-violet-500/60 focus:outline-none transition-all placeholder:text-text-muted/50"
        />
      </div>

      <!-- Clear filters (shows when any filter is active, including category) -->
      <button
        v-if="filterStartDate || filterEndDate || filterMinAmount !== null || filterMaxAmount !== null || selectedCategory !== 'all'"
        @click="clearFilters"
        class="text-xs text-text-muted hover:text-rose-400 transition-colors px-2 py-1 ml-auto"
      >
        Clear Filters
      </button>
    </div>

    <!-- ─── Sync indicator ───────────────────────────────────────────────── -->
    <div v-if="documentStore.syncing" class="mb-4 flex items-center gap-2 text-xs text-text-muted">
      <div class="w-3 h-3  border-slate-500 border-t-transparent rounded-full animate-spin"></div>
      Syncing to cloud…
    </div>

    <!-- ─── Empty state ──────────────────────────────────────────────────── -->
    <div v-if="documents.length === 0" class="text-center py-20">
      <div class="text-5xl mb-4">{{ totalDocuments === 0 ? '📄' : '🔍' }}</div>
      <p class="text-text-secondary font-medium">
        {{ totalDocuments === 0 ? 'No documents yet' : 'No results match your search' }}
      </p>
      <p class="text-text-muted text-sm mt-1">
        {{ totalDocuments === 0 ? 'Scan your first document to get started' : 'Try a different query or clear filters' }}
      </p>
      <NuxtLink
        v-if="totalDocuments === 0"
        to="/scan"
        class="inline-flex mt-4 items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/25"
      >
        Start Scanning →
      </NuxtLink>
    </div>

    <!-- ─── Document grid ────────────────────────────────────────────────── -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="doc in documents"
        :key="doc.id"
        :to="`/doc/${doc.id}`"
        class="relative bg-bg-secondary  border-slate-1/50 rounded-2xl hover:border-sky-500/40 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_-5px_rgba(2,132,199,0.15),0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300 p-4 block group"
      >

        <!-- Delete button -->
        <button
          class="absolute top-3 right-3 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-white  border-slate-200 text-red-600 dark:text-black hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
          title="Delete document"
          @click="deleteDoc(doc.id, $event)"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862
                 a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6
                 M9 7h6m2 0a2 2 0 00-2-2H9
                 a2 2 0 00-2 2m10 0H5" />
          </svg>
        </button>

        <!-- Semantic similarity score badge (shown during search) -->
        <div
          v-if="getSemScore(doc) !== null"
          class="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-mono  border-violet-500/30 z-10"
        >
          {{ getSemScore(doc) }}% match
        </div>

        <!-- Image thumbnail -->
        <div
          v-if="doc.image"
          class="mb-3 h-32 bg-bg-tertiary rounded-xl z-1 overflow-hidden flex items-center justify-center"
        >
          <img
            :src="doc.image"
            class="object-cover h-full w-full opacity-90 group-hover:opacity-100 transition-opacity"
          />
        </div>

        <!-- Date + sync dot + category badge -->
        <div class="flex items-center justify-between mb-2 flex-wrap gap-1">
          <span class="text-text-muted text-[10px]">
            {{ new Date(doc.createdAt).toLocaleString() }}
          </span>
          <div class="flex items-center gap-1.5 flex-wrap">
            <!-- Sync status dot -->
            <span
              class="w-1.5 h-1.5 rounded-full flex-shrink-0"
              :class="doc.synced ? 'bg-success' : 'bg-warning'"
              :title="doc.synced ? 'Synced to cloud' : 'Saved locally, pending sync'"
            ></span>
            <!-- Document type badge -->
            <span
              class="text-[10px] px-2 py-0.5 rounded-lg uppercase tracking-wider font-semibold"
              :class="categoryClass(doc.category)"
            >
              {{ getCategoryLabel(doc.category?.type) }}
            </span>
          </div>
        </div>

        <!-- Expense category + semantic status + tags -->
        <div class="flex items-center gap-1.5 flex-wrap mb-2">
          <span
            v-if="expenseCategoryBadge(doc)"
            class="text-[10px] px-2 py-0.5 rounded-full  font-medium flex items-center gap-1"
            :style="{
              color: expenseCategoryBadge(doc).color,
              borderColor: expenseCategoryBadge(doc).color + '40',
              background: expenseCategoryBadge(doc).color + '12',
            }"
          >
            {{ expenseCategoryBadge(doc).emoji }} {{ expenseCategoryBadge(doc).label }}
          </span>
          <span
            v-if="doc.extracted?.semanticStatus"
            class="text-[10px] px-2 py-0.5 rounded-full  font-medium flex items-center gap-1 bg-sky-500/10 text-sky-400 border-sky-500/30 capitalize"
          >
            {{ doc.extracted.semanticStatus }}
          </span>
          <span
            v-for="tag in (doc.semanticTags ?? []).slice(0, 2)"
            :key="tag"
            class="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted  border-slate-1"
          >
            {{ tag }}
          </span>
        </div>

        <!-- Extracted fields preview -->
        <div class="space-y-0.5 mb-2">
          <div v-if="doc.extracted?.vendor" class="flex items-center gap-2 text-xs">
            <span class="text-text-muted w-12 flex-shrink-0">Vendor</span>
            <span class="text-text-secondary font-medium truncate">{{ doc.extracted.vendor }}</span>
          </div>
          <div v-if="doc.extracted?.total" class="flex items-center gap-2 text-xs">
            <span class="text-text-muted w-12 flex-shrink-0">Total</span>
            <span class="text-text-primary font-bold font-mono">
              {{ doc.extracted.currency ? doc.extracted.currency + ' ' : '' }}{{ doc.extracted.total }}
            </span>
          </div>
          <div v-if="doc.extracted?.date" class="flex items-center gap-2 text-xs">
            <span class="text-text-muted w-12 flex-shrink-0">Date</span>
            <span class="text-text-secondary">{{ doc.extracted.date }}</span>
          </div>
        </div>

        <!-- OCR text preview -->
        <p class="text-[11px] text-text-muted line-clamp-2 font-mono leading-relaxed">
          {{ doc.cleanedText?.slice(0, 100) ?? '' }}
        </p>

      </NuxtLink>
    </div>

  </div>
</template>
