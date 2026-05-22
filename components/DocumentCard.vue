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
    invoice: 'bg-accent-primary/15 text-accent-primary border-accent-primary/20',
    receipt: 'bg-success/15 text-success border-success/20',
    bill: 'bg-accent-secondary/15 text-accent-secondary border-accent-secondary/20',
    other: 'bg-slate-3/15 text-text-muted border-slate-3/20',
  }
  return colors[type] || colors.other
}
const formatConfidence = (confidence) => {
  return `${Math.round(confidence * 100)}%`
}
</script>

<template>
  <div
    class="group bg-bg-secondary  rounded-xl overflow-hidden transition-all duration-200 hover:border-slate-1/70 hover:shadow-card-hover">

    <div class="relative bg-bg-tertiary">
      <img :src="doc.image" :alt="doc.extracted.vendor || 'Document'" class="w-full object-cover max-h-48" />

      <div class="absolute top-3 right-3">
        <span :class="getCategoryColor(doc.category?.type)"
          class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border backdrop-blur-sm">
          {{ doc.category?.type || 'unknown' }}
        </span>
      </div>

      <div v-if="doc.category?.confidence" class="absolute top-3 left-3">
        <span
          class="inline-flex items-center px-2.5 py-1 bg-bg-primary/80 backdrop-blur-sm text-text-secondary rounded-full text-xs font-medium border border-slate-1/30">
          {{ formatConfidence(doc.category.confidence) }}
        </span>
      </div>
    </div>


    <div class="p-4">
      <h3 v-if="doc.extracted.vendor"
        class="text-base font-semibold text-text-primary mb-3 truncate group-hover:text-accent-primary transition-colors">
        {{ doc.extracted.vendor }}
      </h3>
      <div class="space-y-2 text-sm">
        <div v-if="doc.extracted.date" class="flex justify-between items-center">
          <span class="text-text-muted font-medium">Date</span>
          <span class="text-text-secondary">{{ formatDate(doc.extracted.date) }}</span>
        </div>

        <div v-if="doc.extracted.total" class="flex justify-between items-center">
          <span class="text-text-muted font-medium">Total</span>
          <span class="text-text-primary font-semibold">{{ doc.extracted.total }}</span>
        </div>

        <div v-if="doc.extracted.receiptNumber || doc.extracted.invoiceNumber"
          class="flex justify-between items-center">
          <span class="text-text-muted font-medium">
            {{ doc.category?.type === 'invoice' ? 'Invoice #' : 'Receipt #' }}
          </span>
          <span class="text-text-secondary font-mono text-xs">
            {{ doc.extracted.receiptNumber || doc.extracted.invoiceNumber || '—' }}
          </span>
        </div>
        <div v-if="doc.extracted.invoiceNumber && doc.category?.type === 'invoice'"
          class="flex justify-between items-center">
          <span class="text-text-muted font-medium">Invoice #</span>
          <span class="text-text-secondary font-mono text-xs">
            {{ doc.extracted.invoiceNumber }}
          </span>
        </div>
      </div>


      <div class="mt-3 pt-3 border-t border-slate-1/30">
        <p class="text-xs text-text-muted">
          Scanned {{ new Date(doc.createdAt).toLocaleString() }}
        </p>
      </div>


      <details class="mt-3 group/ocr">
        <summary
          class="cursor-pointer text-xs text-text-muted hover:text-text-secondary font-medium flex items-center gap-1 select-none transition-colors">
          <svg class="w-4 h-4 transition-transform group-open/ocr:rotate-90" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          View Raw OCR Text
        </summary>
        <div class="mt-2 bg-bg-primary/50 rounded-lg p-3 border border-slate-1/30">
          <pre
            class="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">{{ doc.cleanedText || doc.ocrText || 'No text available' }}</pre>
        </div>
      </details>
    </div>
  </div>
</template>