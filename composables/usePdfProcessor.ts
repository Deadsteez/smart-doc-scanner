import { ref, readonly, onBeforeUnmount } from 'vue'

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

      const plainOptions = JSON.parse(JSON.stringify(options))
      const pdfData = data.slice(0)
      worker.postMessage({ pdfData, options: plainOptions })
    })
  }

  const isPdfFile = (file: File): boolean => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  }

  
  const validatePdfFile = (file: File): { valid: boolean; error?: string } => {
    if (!isPdfFile(file)) {
      return { valid: false, error: 'File is not a PDF' }
    }

    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024 
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
          const arrayBuffer = reader.result as ArrayBuffer
          
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
  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    isProcessing: readonly(isProcessing),
    progress: readonly(progress),
    error: readonly(error),
    processPdf,
    isPdfFile,
    validatePdfFile,
    getPdfInfo,
    cleanup
  }
}