<script setup>
import { onMounted, computed, ref } from 'vue'
import { useDocumentStore } from '~/stores/documentStore'

const documentStore = useDocumentStore()

// UI state
const searchQuery = ref('')
const selectedCategory = ref('all')

// Load documents once
onMounted(async () => {
  await documentStore.loadAll()
})

// Filtered documents
const documents = computed(() => {
  return documentStore.documents.filter(doc => {
    const matchesSearch =
      doc.cleanedText
        .toLowerCase()
        .includes(searchQuery.value.toLowerCase())

    const matchesCategory =
      selectedCategory.value === 'all' ||
      doc.category === selectedCategory.value

    return matchesSearch && matchesCategory
  })
})
</script>


<template>
  <div class="p-6 max-w-5xl mx-auto">

    <!-- Navigation -->
    <nav class="mb-6 flex gap-4 text-blue-400">
      <NuxtLink to="/">Dashboard</NuxtLink>
      <NuxtLink to="/scan">Scan</NuxtLink>
    </nav>

    <h1 class="text-2xl font-semibold text-white mb-6">
      Scanned Documents
    </h1>

    <!-- Search + Filter -->
    <div class="flex gap-4 mb-6">
      <input
        v-model="searchQuery"
        placeholder="Search OCR text…"
        class="px-3 py-2 rounded bg-gray-900 text-white w-full"
      />

      <select
        v-model="selectedCategory"
        class="px-3 py-2 rounded bg-gray-900 text-white"
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

    <!-- Document list -->
    <div class="grid gap-4 md:grid-cols-2">
      <NuxtLink
        v-for="doc in documents"
        :key="doc.id"
        :to="`/doc/${doc.id}`"
        class="block p-4 bg-gray-900 rounded hover:bg-gray-800 text-white"
      >
        <div class="flex justify-between text-sm text-gray-400 mb-2">
          <span>{{ new Date(doc.createdAt).toLocaleString() }}</span>
          <span class="uppercase">{{ doc.category }}</span>
        </div>

        <pre class="text-sm whitespace-pre-wrap">
{{ doc.cleanedText.slice(0, 150) }}…
        </pre>
      </NuxtLink>
    </div>

  </div>
</template>

