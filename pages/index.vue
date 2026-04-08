<script setup>
import { onMounted, computed, ref } from 'vue'
import { useDocumentStore } from '~/stores/documentStore'
import { exportDocumentsToCSV } from '~/services/exportCsv'
import { exportMultipleDocumentsToPDF } from '~/services/exportPdf'
import AppNavbar from '~/components/AppNavbar.vue'


const documentStore = useDocumentStore()

const searchQuery = ref('')
const selectedCategory = ref('all')
const vendorFilter = ref('')
const dateFilter = ref('')
const amountFilter = ref('')


onMounted(async () => {
  await documentStore.loadAll()
})

const documents = computed(() => {
  return documentStore.documents.filter(doc => {
    const matchesSearch =
      (doc.cleanedText ?? '').toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesCategory =
      selectedCategory.value === 'all' ||
      doc.category?.type === selectedCategory.value

    const matchesVendor =
      !vendorFilter.value ||
      (doc.extracted?.vendor ?? '').toLowerCase().includes(vendorFilter.value.toLowerCase())

    const matchesDate =
      !dateFilter.value ||
      (doc.extracted?.date ?? '').includes(dateFilter.value)

    const matchesAmount =
      !amountFilter.value ||
      (doc.extracted?.total ?? '').includes(amountFilter.value)

    return matchesSearch && matchesCategory && matchesVendor && matchesDate && matchesAmount
  })
})


function deleteDoc(id, event) {
  event.preventDefault()
  event.stopPropagation()
  if (!confirm('Delete this document?')) return
  documentStore.remove(id)
}

function clearFilters() {
  vendorFilter.value = ''
  dateFilter.value = ''
  amountFilter.value = ''
}

function categoryClass(category) {
  return {
    receipt:       'bg-blue-500/20 text-blue-400',
    invoice:       'bg-green-500/20 text-green-400',
    bill:          'bg-purple-500/20 text-purple-400',
    other:         'bg-gray-500/20 text-gray-300',
    uncategorized: 'bg-gray-500/20 text-gray-300',
  }[category?.type] || 'bg-gray-500/20 text-gray-300'
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
    <AppNavbar />
    <div class="p-6 max-w-6xl mx-auto">


<div class="flex justify-between items-center mb-6">
  <h1 class="text-2xl font-semibold">Scanned Documents</h1>
  <div class="flex gap-2">
    <button
      class="bg-green-600/90 hover:bg-green-600 px-4 py-2 rounded text-sm transition flex items-center gap-2 text-white"
      @click="exportDocumentsToCSV(documents)"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Export CSV
    </button>
    <button
      class="bg-red-600/90 hover:bg-red-600 px-4 py-2 rounded text-sm transition flex items-center gap-2 text-white"
      @click="exportMultipleDocumentsToPDF(documents)"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      Export PDF
    </button>
  </div>
</div>


<!-- Search + Filter -->
<div class="space-y-4 mb-8">

  <input v-model="searchQuery" placeholder="Search OCR text…"
    class="w-full px-4 py-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 transition text-gray-900 dark:text-white"
  />

  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
   
    <select
      v-model="selectedCategory"
      class="px-4 py-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none text-gray-900 dark:text-white"
    >
      <option value="all">All Categories</option>
      <option value="receipt">Receipt</option>
      <option value="invoice">Invoice</option>
      <option value="bill">Bill</option>
      <option value="other">Other</option>
      <option value="uncategorized">Uncategorized</option>
    </select>

    
    <input
      v-model="vendorFilter"
      placeholder="Filter by vendor…"
      class="px-4 py-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 transition text-gray-900 dark:text-white"
    />

    <input
      v-model="dateFilter"
      type="date"
      placeholder="Filter by date"
      class="px-4 py-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 transition text-gray-900 dark:text-white"
    />

    <input
      v-model="amountFilter"
      placeholder="Filter by amount…"
      class="px-4 py-2 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:border-gray-400 dark:focus:border-gray-600 transition text-gray-900 dark:text-white"
    />
  </div>

  <button
    v-if="vendorFilter || dateFilter || amountFilter"
    @click="clearFilters"
    class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
  >
    ✕ Clear all filters
  </button>
</div>
     
      <div v-if="documents.length === 0" class="text-gray-600 dark:text-gray-400 text-center py-16">
        No matching documents.
      </div>

      <div
        v-if="documentStore.syncing"
        class="mb-4 text-xs text-gray-500 flex items-center gap-1.5"
      >
        <div class="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin"></div>
        Syncing to cloud…
      </div>

      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink v-for="doc in documents" :key="doc.id" :to="`/doc/${doc.id}`"
          class="relative bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition p-4 block">

          <button class="absolute top-2 right-2 text-red-700 hover:text-red-500 transition"
            title="Delete document"
            @click="deleteDoc(doc.id, $event)"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862
                   a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6
                   M9 7h6m2 0a2 2 0 00-2-2H9
                   a2 2 0 00-2 2m10 0H5" />
            </svg>
          </button>

          <div
            v-if="doc.image"
            class="mb-3 h-32 bg-gray-100 dark:bg-black rounded overflow-hidden flex items-center justify-center"
          >
            <img :src="doc.image" class="object-cover h-full w-full opacity-90" />
          </div>

          <div class="flex justify-between items-center mb-2">
            <span class="text-xs text-gray-600 dark:text-gray-400">
              {{ new Date(doc.createdAt).toLocaleString() }}
            </span>

            <div class="flex items-center gap-1.5">
              <span
                :title="doc.synced ? 'Synced to cloud' : 'Saved locally, pending sync'"
                class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                :class="doc.synced ? 'bg-green-500' : 'bg-yellow-500'"
              ></span>

              <span
                class="text-xs px-2 py-1 rounded uppercase tracking-wide"
                :class="categoryClass(doc.category)"
              >
                {{ doc.category?.type ?? 'other' }}
              </span>
            </div>
          </div>

          <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-4 whitespace-pre-wrap">
            {{ doc.cleanedText?.slice(0, 200) ?? '' }}…
          </p>
        </NuxtLink>
      </div>

    </div>
  </div>
</template>