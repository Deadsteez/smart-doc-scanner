<script setup>
import { onMounted, computed, ref } from 'vue'
import { useDocumentStore } from '~/stores/documentStore'
import { exportDocumentsToCSV } from '~/services/exportCsv'
import AppNavbar from '~/components/AppNavbar.vue'


const documentStore = useDocumentStore()

const searchQuery = ref('')
const selectedCategory = ref('all')

onMounted(async () => {
  await documentStore.loadAll()
})

const documents = computed(() => {
  return documentStore.documents.filter(doc => {
    const matchesSearch =
      (doc.cleanedText ?? '').toLowerCase().includes(searchQuery.value.toLowerCase())

    // category is { type, confidence, scores } 
    const matchesCategory =
      selectedCategory.value === 'all' ||
      doc.category?.type === selectedCategory.value

    return matchesSearch && matchesCategory
  })
})

function deleteDoc(id, event) {
  event.preventDefault()
  event.stopPropagation()
  if (!confirm('Delete this document?')) return
  documentStore.remove(id)
}

// receives category object, reads .type for the color lookup
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
  <div class="min-h-screen bg-black text-white">
    <AppNavbar />
    <div class="p-6 max-w-6xl mx-auto">

      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-semibold">Scanned Documents</h1>
        <button
          class="bg-green-600/90 hover:bg-green-600 px-4 py-2 rounded text-sm transition"
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
          class="flex-1 px-4 py-2 rounded bg-gray-900 border border-gray-800 focus:outline-none focus:border-gray-600 transition"
        />

        <select
          v-model="selectedCategory"
          class="px-4 py-2 rounded bg-gray-900 border border-gray-800 focus:outline-none"
        >
          <option value="all">All</option>
          <option value="receipt">Receipt</option>
          <option value="invoice">Invoice</option>
          <option value="bill">Bill</option>
          <option value="other">Other</option>
          <option value="uncategorized">Uncategorized</option>
        </select>
      </div>

      <!-- Empty state -->
      <div v-if="documents.length === 0" class="text-gray-400 text-center py-16">
        No matching documents.
      </div>

      <!-- Sync indicator -->
      <div
        v-if="documentStore.syncing"
        class="mb-4 text-xs text-gray-500 flex items-center gap-1.5"
      >
        <div class="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin"></div>
        Syncing to cloud…
      </div>

      <!-- Document Grid -->
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="doc in documents"
          :key="doc.id"
          :to="`/doc/${doc.id}`"
          class="relative bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 transition p-4 block"
        >
          <!-- Delete button -->
          <button
            class="absolute top-2 right-2 text-red-700 hover:text-red-500 transition"
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

          <!-- Thumbnail -->
          <div
            v-if="doc.image"
            class="mb-3 h-32 bg-black rounded overflow-hidden flex items-center justify-center"
          >
            <img :src="doc.image" class="object-cover h-full w-full opacity-90" />
          </div>

          <!-- Meta -->
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs text-gray-400">
              {{ new Date(doc.createdAt).toLocaleString() }}
            </span>

            <div class="flex items-center gap-1.5">
              <!-- Sync dot — gray if not yet synced to Supabase -->
              <span
                :title="doc.synced ? 'Synced to cloud' : 'Saved locally, pending sync'"
                class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                :class="doc.synced ? 'bg-green-500' : 'bg-yellow-500'"
              ></span>

              <!--display category.type not the whole category object -->
              <span
                class="text-xs px-2 py-1 rounded uppercase tracking-wide"
                :class="categoryClass(doc.category)"
              >
                {{ doc.category?.type ?? 'other' }}
              </span>
            </div>
          </div>

          <!-- Text preview -->
          <p class="text-sm text-gray-300 line-clamp-4 whitespace-pre-wrap">
            {{ doc.cleanedText?.slice(0, 200) ?? '' }}…
          </p>
        </NuxtLink>
      </div>

    </div>
  </div>
</template>