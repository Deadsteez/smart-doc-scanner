<script setup>
defineProps({
  doc: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <div class="bg-gray-900 rounded-lg p-4 shadow">

    <img
      :src="doc.image"
      class="rounded mb-3 w-full object-cover max-h-64"
    />

    <div class="text-sm text-gray-300 space-y-1">
      <p><span class="font-medium">Vendor:</span> {{ doc.extracted.vendor || '—' }}</p>
      <p><span class="font-medium">Date:</span> {{ doc.extracted.date || '—' }}</p>
      <p><span class="font-medium">Total:</span> {{ doc.extracted.total || '—' }}</p>
      <p><span class="font-medium">Receipt #:</span> {{ doc.extracted.receiptNumber || '—' }}</p>
    </div>

    <details class="mt-3 text-xs text-gray-400">
      <summary class="cursor-pointer">Raw OCR</summary>
      <pre class="whitespace-pre-wrap mt-2">{{ doc.cleanedText }}</pre>
    </details>

  </div>
</template>
