<script setup>
defineProps({
  src: String,
  title: String
})
defineEmits(['delete'])
</script>
<template>
  <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
    <div class="flex justify-between items-center mb-3">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ title }}
      </h3>
      <button @click="$emit('delete')"
        class="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        title="Delete image">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
    <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
      <img :src="src" :alt="title" class="rounded-lg max-h-[280px] mx-auto shadow-md" />
    </div>
  </div>
</template>