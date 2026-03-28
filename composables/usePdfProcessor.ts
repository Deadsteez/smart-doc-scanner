import { ref, readonly, onBeforeUnmount } from 'vue'

// Composable for PDF processing functionality

export interface PdfPage {
  pageNumber: number
  image?: string
  width?: number
  height?: number
  error?: string
}

export interface PdfProcessingOptions {
  maxPages?: number
  scale?: number
  outputFormat?: 'png' | 'jpeg'
}

export interface PdfProcessingResult {
  pages: PdfPage[]
  totalPages: number
  successfulPages: number
}

export interface PdfProcessingProgress {
  progress: number
  status: string
  currentPage?: number
  totalPages?: number
}

export const usePdfProcessor = () => {
  const isProcessing = ref(false)
  const progress = ref<PdfProcessingProgress | null>(null)
  const error = ref<string | null>(null)

  let pdfWorker: Worker | null = null

  // Initialize worker
  const initWorker = () => {
    if (pdfWorker) return pdfWorker

    pdfWorker = new Worker('/workers/pdfWorker.js')
    
    pdfWorker.onerror = (err) => {
      console.error('[PDF Processor] Worker error:', err)
      error.value = 'PDF worker failed to initialize'
      isProcessing.value = false
    }

    return pdfWorker
  }

  const processPdf = (
    data: ArrayBuffer,
    options: PdfProcessingOptions = {}
  ): Promise<PdfProcessingResult> => {
    return new Promise((resolve, reject) => {
      if (isProcessing.value) {
        reject(new Error('PDF processing already in progress'))
        return
      }

      const worker = initWorker()
      if (!worker) {
        reject(new Error('Failed to initialize PDF worker'))
        return
      }

      isProcessing.value = true
      error.value = null
      progress.value = { progress: 0, status: 'Starting PDF processing...' }

      const handleMessage = (e: MessageEvent) => {
        const msg = e.data

        if (msg.type === 'progress') {
          progress.value = {
            progress: msg.progress,
            status: msg.status,
            currentPage: msg.currentPage,
            totalPages: msg.totalPages
          }
          return
        }

        if (msg.type === 'result') {
          worker.removeEventListener('message', handleMessage)
          isProcessing.value = false
          progress.value = { progress: 1, status: 'PDF processing complete' }
          resolve({
            pages: msg.pages,
            totalPages: msg.totalPages,
            successfulPages: msg.successfulPages
          })
          return
        }

        if (msg.type === 'error') {
          worker.removeEventListener('message', handleMessage)
          isProcessing.value = false
          error.value = msg.detail || 'PDF processing failed'
          progress.value = null
          reject(new Error(error.value ?? 'PDF processing failed'))
        }
      }

      worker.addEventListener('message', handleMessage)

      // Strip Vue reactive proxy (if options came from a ref/reactive)
      // Reactive proxies cannot be cloned by postMessage — must use plain object
      const plainOptions = JSON.parse(JSON.stringify(options))
      const pdfData = data.slice(0)
      worker.postMessage({ pdfData, options: plainOptions })
    })
  }

  // Check if file is PDF
  const isPdfFile = (file: File): boolean => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  }

  // Validate PDF file
  const validatePdfFile = (file: File): { valid: boolean; error?: string } => {
    if (!isPdfFile(file)) {
      return { valid: false, error: 'File is not a PDF' }
    }

    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return { valid: false, error: 'PDF file too large (max 50MB)' }
    }

    return { valid: true }
  }

  // Get PDF info without processing
  const getPdfInfo = async (file: File): Promise<{ numPages: number; fileSize: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async () => {
        try {
          // This is a simplified approach - in a real implementation,
          // you might want to use PDF.js to get actual page count
          const arrayBuffer = reader.result as ArrayBuffer
          
          // For now, estimate based on file size (rough approximation)
          const estimatedPages = Math.max(1, Math.floor(file.size / (100 * 1024))) // ~100KB per page
          
          resolve({
            numPages: estimatedPages,
            fileSize: file.size
          })
        } catch (err) {
          reject(err)
        }
      }
      
      reader.onerror = () => reject(new Error('Failed to read PDF file'))
      reader.readAsArrayBuffer(file)
    })
  }

  // Cleanup
  const cleanup = () => {
    if (pdfWorker) {
      pdfWorker.terminate()
      pdfWorker = null
    }
    isProcessing.value = false
    progress.value = null
    error.value = null
  }

  // Auto cleanup on unmount
  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    // State
    isProcessing: readonly(isProcessing),
    progress: readonly(progress),
    error: readonly(error),
    
    // Methods
    processPdf,
    isPdfFile,
    validatePdfFile,
    getPdfInfo,
    cleanup
  }
}