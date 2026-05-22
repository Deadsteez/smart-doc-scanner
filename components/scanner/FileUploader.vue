<script setup>
const emit = defineEmits(['upload'])
function handleChange(event) {
  emit('upload', event)
}
</script>
<template>
  <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
    <label class="block cursor-pointer">
      <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Or upload a file
      </span>
      <input type="file" accept="image/*" @change="handleChange" class="block w-full text-sm text-gray-600 dark:text-gray-400
               file:mr-4 file:py-2.5 file:px-4
               file:rounded-lg file:border-0
               file:text-sm file:font-medium
               file:bg-blue-50 file:text-blue-700
               dark:file:bg-blue-900/20 dark:file:text-blue-400
               hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30
               file:cursor-pointer file:transition-colors duration-150" />
    </label>
  </div>
</template>