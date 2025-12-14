<script setup>
import { onMounted, computed, ref } from 'vue'
import { useDocumentStore } from '~/stores/documentStore'
import { exportDocumentsToCSV } from '~/services/exportCsv'

const documentStore = useDocumentStore()

const searchQuery = ref('')
const selectedCategory = ref('all')

onMounted(async () => {
  await documentStore.loadAll()
})

const documents = computed(() => {
  return documentStore.documents.filter(doc => {
    const matchesSearch =
      doc.cleanedText.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesCategory =
      selectedCategory.value === 'all' ||
      doc.category === selectedCategory.value

    return matchesSearch && matchesCategory
  })
})

function deleteDoc(id, event) {
  event.preventDefault()
  event.stopPropagation()
  if (!confirm('Delete this document?')) return
  documentStore.remove(id)
}

function categoryClass(category) {
  return {
    receipt: 'bg-blue-500/20 text-blue-400',
    invoice: 'bg-green-500/20 text-green-400',
    bill: 'bg-purple-500/20 text-purple-400',
    other: 'bg-gray-500/20 text-gray-300',
    uncategorized: 'bg-gray-500/20 text-gray-300'
  }[category] || 'bg-gray-500/20 text-gray-300'
}
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <div class="p-6 max-w-6xl mx-auto">

      <!-- Navigation -->
      <nav class="mb-8 flex gap-6 text-blue-400 text-sm">
        <NuxtLink to="/" class="hover:underline">Dashboard</NuxtLink>
        <NuxtLink to="/scan" class="hover:underline">Scan</NuxtLink>
      </nav>

      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-semibold">
          Scanned Documents
        </h1>

        <button
          class="bg-green-600/90 hover:bg-green-600 px-4 py-2 rounded text-sm"
          @click="exportDocumentsToCSV(documents)"
        >
          Export CSV
        </button>
      </div>

      <!-- Search + Filter -->
      <div class="flex gap-4 mb-8">
        <input
          v-model="searchQuery"
          placeholder="Search OCR text…"
          class="flex-1 px-4 py-2 rounded bg-gray-900 border border-gray-800 focus:outline-none"
        />

        <select
          v-model="selectedCategory"
          class="px-4 py-2 rounded bg-gray-900 border border-gray-800"
        >
          <option value="all">All</option>
          <option value="receipt">Receipt</option>
          <option value="invoice">Invoice</option>
          <option value="bill">Bill</option>
          <option value="other">Other</option>
          <option value="uncategorized">Uncategorized</option>
        </select>
      </div>

      <div v-if="documents.length === 0" class="text-gray-400">
        No matching documents.
      </div>

      <!-- Document Grid -->
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="doc in documents"
          :key="doc.id"
          :to="`/doc/${doc.id}`"
          class="relative bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 transition p-4"
        >
          <!-- Delete -->
          <button
            class="absolute top-2 right-2 text-red-700 hover:text-red-600 opacity-100"
            title="Delete document"
            @click="deleteDoc(doc.id, $event)"
          >
            <svg xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5">
              <path stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862
                      a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6
                      M9 7h6m2 0a2 2 0 00-2-2H9
                      a2 2 0 00-2 2m10 0H5" />
            </svg>
          </button>



          <!-- Thumbnail -->
          <div
            v-if="doc.image"
            class="mb-3 h-32 bg-black rounded overflow-hidden flex items-center justify-center"
          >
            <img
              :src="doc.image"
              class="object-cover h-full w-full opacity-90"
            />
          </div>

          <!-- Meta -->
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs text-gray-400">
              {{ new Date(doc.createdAt).toLocaleString() }}
            </span>
            <span
              class="text-xs px-2 py-1 rounded uppercase tracking-wide"
              :class="categoryClass(doc.category)"
            >
              {{ doc.category }}
            </span>
          </div>

          <!-- Preview -->
          <p class="text-sm text-gray-300 line-clamp-4 whitespace-pre-wrap">
            {{ doc.cleanedText.slice(0, 200) }}…
          </p>
        </NuxtLink>
      </div>

    </div>
  </div>
</template>
