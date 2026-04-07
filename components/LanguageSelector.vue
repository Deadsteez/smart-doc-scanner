
<script setup>
import { ref } from 'vue'

const selectedLanguage = defineModel({ default: 'eng' })

const languages = [
  { code: 'eng', name: 'English', flag: '🇬🇧' },
  { code: 'hin', name: 'Hindi', flag: '🇮🇳' },
  { code: 'mar', name: 'Marathi', flag: '🇮🇳' }
]

</script>

<template>
  <div class="flex items-center gap-2">
    <label class="text-sm text-gray-600 dark:text-gray-400">OCR Language:</label>
    <select
      v-model="selectedLanguage"
      class="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-300 text-sm focus:outline-none focus:border-gray-400 dark:focus:border-gray-600"
    >
      <option v-for="lang in languages" :key="lang.code" :value="lang.code">
        {{ lang.flag }} {{ lang.name }}
      </option>
    </select>
  </div>
</template>
