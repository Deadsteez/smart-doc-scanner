<script setup>
defineProps({
  src: String,
  isProcessing: Boolean
})

defineEmits(['runOcr'])
</script>

<template>
  <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
    <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
      Preprocessed Document
    </h3>

    <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
      <img :src="src" alt="Preprocessed document ready for OCR" class="rounded-lg max-h-[280px] mx-auto shadow-md" />
    </div>

    <button @click="$emit('runOcr')" :disabled="isProcessing"
      class="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-400 dark:disabled:bg-gray-700 text-white font-medium px-5 py-3 rounded-lg transition-colors duration-150 flex items-center justify-center gap-2 disabled:cursor-not-allowed">
      <template v-if="!isProcessing">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Run OCR
      </template>
      <template v-else>
        <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        Processing...
      </template>
    </button>
  </div>
</template>