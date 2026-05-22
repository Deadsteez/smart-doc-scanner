<script setup>
import { onMounted, computed, ref } from 'vue'
import { useDocumentStore } from '~/stores/documentStore'
import { exportDocumentsToCSV } from '~/services/exportCsv'
import { exportMultipleDocumentsToPDF } from '~/services/exportPdf'

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
        receipt: 'bg-accent-primary/15 text-accent-primary',
        invoice: 'bg-success/15 text-success',
        bank_statement: 'bg-info/15 text-info',
        payment_slip: 'bg-warning/15 text-warning',
        utility_bill: 'bg-violet-500/15 text-violet-500',
        tax_document: 'bg-rose-500/15 text-rose-500',
        contract: 'bg-cyan-500/15 text-cyan-500',
        other: 'bg-slate-1/30 text-text-muted',
        uncategorized: 'bg-slate-1/30 text-text-muted',
    }[category?.type] || 'bg-slate-1/30 text-text-muted'
}
</script>

<template>
    <div class="p-6 max-w-6xl mx-auto font-sans animate-fade-in">


        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 class="text-2xl font-semibold text-text-primary">Scanned Documents</h1>
            <div class="flex gap-3">
                <button
                    class="bg-success  text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-[0_4px_14px_0_rgba(16,185,129,0.2)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.4)] active:scale-[0.98]"
                    @click="exportDocumentsToCSV(documents)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                </button>

                <button
                    class="bg-error  text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-[0_4px_14px_0_rgba(239,68,68,0.2)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.4)]  active:scale-[0.98]"
                    @click="exportMultipleDocumentsToPDF(documents)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Export PDF
                </button>
            </div>
        </div>

        <div class="space-y-4 mb-8">

            <input v-model="searchQuery" placeholder="Search OCR text…"
                class="w-full px-4 py-2.5 rounded-xl bg-bg-secondary border border-slate-1 text-text-primary placeholder-text-muted shadow-card focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all" />

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                <select v-model="selectedCategory"
                    class="px-4 py-2.5 rounded-xl bg-bg-secondary border border-slate-1 text-text-primary shadow-card focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all">
                    <option value="all">All Categories</option>
                    <option value="receipt">Receipt</option>
                    <option value="invoice">Invoice</option>
                    <option value="bill">Bill</option>
                    <option value="other">Other</option>
                    <option value="uncategorized">Uncategorized</option>
                </select>

                <input v-model="vendorFilter" placeholder="Filter by vendor…"
                    class="px-4 py-2.5 rounded-xl bg-bg-secondary border border-slate-1 text-text-primary placeholder-text-muted shadow-card focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all" />

                <input v-model="dateFilter" type="date" placeholder="Filter by date"
                    class="px-4 py-2.5 rounded-xl bg-bg-secondary border border-slate-1 text-text-primary placeholder-text-muted shadow-card focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all" />

                <input v-model="amountFilter" placeholder="Filter by amount…"
                    class="px-4 py-2.5 rounded-xl bg-bg-secondary border border-slate-1 text-text-primary placeholder-text-muted shadow-card focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all" />
            </div>

            <button v-if="vendorFilter || dateFilter || amountFilter" @click="clearFilters"
                class="text-sm text-text-muted hover:text-text-primary transition-all">
                ✕ Clear all filters
            </button>
        </div>


        <div v-if="documents.length === 0" class="text-text-muted text-center py-16">
            No matching documents.
        </div>


        <div v-if="documentStore.syncing" class="mb-4 text-xs text-text-muted flex items-center gap-1.5">
            <div class="w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin"></div>
            Syncing to cloud…
        </div>


        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <NuxtLink v-for="doc in documents" :key="doc.id" :to="`/doc/${doc.id}`"
                class="relative bg-bg-secondary border border-slate-1 rounded-xl shadow-elevated hover:shadow-[0_10px_30px_-5px_rgba(2,132,199,0.15),0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 transition-all duration-300 p-4 block">


                <button class="absolute top-3 z-50 right-3 text-error/70 hover:text-error transition-all"
                    title="Delete document" @click="deleteDoc(doc.id, $event)">
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862
                 a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6
                 M9 7h6m2 0a2 2 0 00-2-2H9
                 a2 2 0 00-2 2m10 0H5" />
                    </svg>
                </button>


                <div v-if="doc.image"
                    class="mb-3 h-32 bg-bg-tertiary rounded-xl z-1 overflow-hidden flex items-center justify-center">
                    <img :src="doc.image" class="object-cover h-full w-full opacity-90" />
                </div>


                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs text-text-muted">
                        {{ new Date(doc.createdAt).toLocaleString() }}
                    </span>

                    <div class="flex items-center gap-1.5">
                        <span :title="doc.synced ? 'Synced to cloud' : 'Saved locally, pending sync'"
                            class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            :class="doc.synced ? 'bg-success' : 'bg-warning'"></span>

                        <span class="text-xs px-2 py-1 rounded-lg uppercase tracking-wide font-medium"
                            :class="categoryClass(doc.category)">
                            {{ doc.category?.type ?? 'other' }}
                        </span>
                    </div>
                </div>


                <p class="text-sm text-text-secondary line-clamp-4 whitespace-pre-wrap">
                    {{ doc.cleanedText?.slice(0, 200) ?? '' }}…
                </p>
            </NuxtLink>
        </div>

    </div>
</template>