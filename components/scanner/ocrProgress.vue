<script setup>
defineProps({
  progress: Number
})
</script>

<template>
  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
    <div class="flex items-center gap-3 mb-3">
      <!-- FIXED: border-3 is not a valid Tailwind class, use border-[3px] -->
      <div class="w-6 h-6 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-sm font-medium text-blue-900 dark:text-blue-100">
        Extracting text from document...
      </span>
    </div>

    <div class="relative w-full bg-blue-200 dark:bg-blue-900/50 rounded-full h-2 overflow-hidden">
      <div
        class="absolute top-0 left-0 h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
        :style="{ width: `${progress}%` }"
      ></div>
    </div>

    <p class="text-xs text-blue-700 dark:text-blue-300 mt-2 text-right font-medium">
      {{ progress }}%
    </p>
  </div>
</template>