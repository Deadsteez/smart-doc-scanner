<script setup>
defineProps({
  doc: {
    type: Object,
    required: true
  }
})
const formatDate = (dateString) => {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  } catch {
    return dateString
  }
}
const getCategoryColor = (type) => {
  const colors = {
    invoice: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    receipt: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }
  return colors[type] || colors.other
}
const formatConfidence = (confidence) => {
  return `${Math.round(confidence * 100)}%`
}
</script>

<template>
  <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
    <div class="relative bg-gray-100 dark:bg-gray-800">
      <img
        :src="doc.image"
        :alt="doc.extracted.vendor || 'Document'"
        class="w-full object-cover max-h-48"
      />
      <div class="absolute top-3 right-3">
        <span 
          :class="getCategoryColor(doc.category?.type)"
          class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize shadow-sm"
        >
          {{ doc.category?.type || 'unknown' }}
        </span>
      </div>
      <div 
        v-if="doc.category?.confidence" 
        class="absolute top-3 left-3"
      >
        <span class="inline-flex items-center px-2.5 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium shadow-sm">
          {{ formatConfidence(doc.category.confidence) }}
        </span>
      </div>
    </div>
    <div class="p-4">
      <h3 
        v-if="doc.extracted.vendor" 
        class="text-lg font-semibold text-gray-900 dark:text-white mb-3 truncate"
      >
        {{ doc.extracted.vendor }}
      </h3>
      <div class="space-y-2 text-sm">
        <div 
          v-if="doc.extracted.date"
          class="flex justify-between items-center"
        >
          <span class="text-gray-600 dark:text-gray-400 font-medium">Date:</span>
          <span class="text-gray-900 dark:text-gray-100">{{ formatDate(doc.extracted.date) }}</span>
        </div>

        <div 
          v-if="doc.extracted.total"
          class="flex justify-between items-center"
        >
          <span class="text-gray-600 dark:text-gray-400 font-medium">Total:</span>
          <span class="text-gray-900 dark:text-gray-100 font-semibold">{{ doc.extracted.total }}</span>
        </div>

        <div 
          v-if="doc.extracted.receiptNumber || doc.extracted.invoiceNumber"
          class="flex justify-between items-center"
        >
          <span class="text-gray-600 dark:text-gray-400 font-medium">
            {{ doc.category?.type === 'invoice' ? 'Invoice #:' : 'Receipt #:' }}
          </span>
          <span class="text-gray-900 dark:text-gray-100 font-mono text-xs">
            {{ doc.extracted.receiptNumber || doc.extracted.invoiceNumber || '—' }}
          </span>
        </div>
        <div 
          v-if="doc.extracted.invoiceNumber && doc.category?.type === 'invoice'"
          class="flex justify-between items-center"
        >
          <span class="text-gray-600 dark:text-gray-400 font-medium">Invoice #:</span>
          <span class="text-gray-900 dark:text-gray-100 font-mono text-xs">
            {{ doc.extracted.invoiceNumber }}
          </span>
        </div>
      </div>
      <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Scanned {{ new Date(doc.createdAt).toLocaleString() }}
        </p>
      </div>
      <details class="mt-3 group">
        <summary class="cursor-pointer text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium flex items-center gap-1 select-none">
          <svg 
            class="w-4 h-4 transition-transform group-open:rotate-90" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          View Raw OCR Text
        </summary>
        <div class="mt-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <pre class="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">{{ doc.cleanedText || doc.ocrText || 'No text available' }}</pre>
        </div>
      </details>
    </div>
  </div>
</template>