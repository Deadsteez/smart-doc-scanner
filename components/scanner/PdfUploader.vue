<script setup>
import { ref, computed } from 'vue'
import { usePdfProcessor } from '~/composables/usePdfProcessor'

const emit = defineEmits(['pages-selected', 'cancel'])
const { 
  isProcessing, 
  progress, 
  error, 
  processPdf, 
  isPdfFile, 
  validatePdfFile 
} = usePdfProcessor()

const fileInputEl = ref(null)
const pdfFile = ref(null)
const pdfPages = ref([])
const selectedPages = ref(new Set())
const processingOptions = ref({
  maxPages: 10,
  scale: 2.0,
  outputFormat: 'png'
})

const hasPages = computed(() => pdfPages.value.length > 0)
const selectedCount = computed(() => selectedPages.value.size)
const canProceed = computed(() => selectedCount.value > 0)

const triggerFileInput = () => {
  fileInputEl.value?.click()
}

const handleFileUpload = async (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return

  const validation = validatePdfFile(file)
  if (!validation.valid) {
    alert(validation.error)
    return
  }

  pdfFile.value = file
  await processPdfFile(file)
  
  event.target.value = ''
}

const processPdfFile = async (file) => {
  try {
    pdfPages.value = []
    selectedPages.value.clear()

    const arrayBuffer = await file.arrayBuffer()
    const result = await processPdf(arrayBuffer, processingOptions.value)
    
    pdfPages.value = result.pages.filter(page => !page.error)
    pdfPages.value.forEach(page => selectedPages.value.add(page.pageNumber))

    if (result.successfulPages < result.totalPages) {
      console.warn(`Only ${result.successfulPages}/${result.totalPages} pages processed`)
    }
  } catch (err) {
    console.error('PDF processing failed:', err)
    alert('Failed to process PDF: ' + err.message)
  }
}

const togglePageSelection = (pageNumber) => {
  if (selectedPages.value.has(pageNumber)) {
    selectedPages.value.delete(pageNumber)
  } else {
    selectedPages.value.add(pageNumber)
  }
}

const selectAllPages = () => {
  pdfPages.value.forEach(page => {
    selectedPages.value.add(page.pageNumber)
  })
}

const deselectAllPages = () => {
  selectedPages.value.clear()
}

const proceedWithSelected = () => {
  const selected = pdfPages.value.filter(page => 
    selectedPages.value.has(page.pageNumber)
  )
  emit('pages-selected', selected)
}

const cancel = () => {
  pdfFile.value = null
  pdfPages.value = []
  selectedPages.value.clear()
  emit('cancel')
}

const isDragging = ref(false)

const handleDragOver = (e) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = (e) => {
  e.preventDefault()
  isDragging.value = false
}

const handleDrop = async (e) => {
  e.preventDefault()
  isDragging.value = false
  
  const files = Array.from(e.dataTransfer.files)
  const droppedFile = files.find(file => isPdfFile(file))
  
  if (droppedFile) {
    const validation = validatePdfFile(droppedFile)
    if (!validation.valid) {
      alert(validation.error)
      return
    }
    pdfFile.value = droppedFile
    await processPdfFile(droppedFile)
  } else {
    alert('Please drop a PDF file')
  }
}
</script>

<template>
  <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
   
    <div class="p-4 border-b border-gray-800">
      <h3 class="text-lg font-semibold text-white mb-1">PDF Document Upload</h3>
      <p class="text-sm text-gray-400">Upload a PDF and select pages to scan</p>
    </div>
    
    <div v-if="!hasPages && !isProcessing" class="p-6">
      <div class="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
        :class="isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <svg class="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        
        <p class="text-gray-300 mb-2">Drop PDF file here or</p>
        
        <button @click="triggerFileInput" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition">
          Choose PDF File
        </button>
        
        <p class="text-xs text-gray-500 mt-3">
          Maximum file size: 50MB • Maximum pages: {{ processingOptions.maxPages }}
        </p>
      </div>

      <input ref="fileInputEl" type="file" accept=".pdf,application/pdf" class="hidden" @change="handleFileUpload"/>
    </div>
    
    <div v-if="isProcessing" class="p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-gray-300">{{ progress?.status || 'Processing PDF...' }}</span>
      </div>
      <div class="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          class="h-full bg-blue-500 transition-all duration-300"
          :style="{ width: `${(progress?.progress || 0) * 100}%` }"
        ></div>
      </div>
      
      <div class="flex justify-between text-xs text-gray-500 mt-2">
        <span>{{ Math.round((progress?.progress || 0) * 100) }}%</span>
        <span v-if="progress?.currentPage && progress?.totalPages">
          Page {{ progress.currentPage }}/{{ progress.totalPages }}
        </span>
      </div>
    </div>
    
    <div v-if="error" class="p-4 bg-red-900/20 border-t border-red-800">
      <div class="flex items-center gap-2 text-red-400 text-sm">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
        </svg>
        {{ error }}
      </div>
    </div>
    
    <div v-if="hasPages && !isProcessing" class="p-4">
      <div class="flex justify-between items-center mb-4">
        <div class="text-sm text-gray-400">
          {{ selectedCount }}/{{ pdfPages.length }} pages selected
        </div>
        
        <div class="flex gap-2">
          <button @click="selectAllPages" class="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition">
            Select All
          </button>

          <button @click="deselectAllPages"class="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition">
            Deselect All
          </button>
        </div>
      </div>

      
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4 max-h-96 overflow-y-auto">
        <div v-for="page in pdfPages":key="page.pageNumber"class="relative border rounded-lg overflow-hidden cursor-pointer transition-all" :class="selectedPages.has(page.pageNumber) ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-gray-700 hover:border-gray-600'"
          @click="togglePageSelection(page.pageNumber)">
         
          <img :src="page.image" alt="`Page ${page.pageNumber}`" class="w-full h-24 object-cover bg-gray-800"/>
          
          <div class="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">{{ page.pageNumber }}</div>

          <div
            v-if="selectedPages.has(page.pageNumber)"
            class="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"
          >
            <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="flex gap-3">
        <button
          @click="proceedWithSelected"
          :disabled="!canProceed"
          class="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-4 py-3 rounded-lg transition"
        >
          Process {{ selectedCount }} Page{{ selectedCount !== 1 ? 's' : '' }}
        </button>
        
        <button @click="cancel"class="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition">
          Cancel
        </button>
      </div>
    </div>

  </div>
</template>