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

  const initWorker = (): Worker => {
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

      let worker: Worker
      try {
        worker = initWorker()
      } catch (err) {
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
            totalPages: msg.totalPages,
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
            successfulPages: msg.successfulPages,
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

  
      worker.postMessage({ pdfData: data, options }, [data])
    })
  }

  const isPdfFile = (file: File): boolean =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  const validatePdfFile = (file: File): { valid: boolean; error?: string } => {
    if (!isPdfFile(file)) {
      return { valid: false, error: 'File is not a PDF' }
    }

    const maxSize = 50 * 1024 * 1024   
    if (file.size > maxSize) {
      return { valid: false, error: 'PDF file too large (max 50MB)' }
    }

    return { valid: true }
  }

 
  const getPdfInfo = async (file: File): Promise<{ numPages: number; fileSize: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = async () => {
        try {
          const buffer = reader.result as ArrayBuffer
          const bytes = new Uint8Array(buffer)
          const text = new TextDecoder('latin1').decode(bytes)
          const match = text.match(/\/Count\s+(\d+)/)
          const numPages = match?.[1] ? parseInt(match[1], 10) : null

          if (!numPages || numPages < 1) {
            reject(new Error('Could not determine page count from PDF'))
            return
          }

          resolve({ numPages, fileSize: file.size })
        } catch (err) {
          reject(err)
        }
      }

      reader.onerror = () => reject(new Error('Failed to read PDF file'))
      reader.readAsArrayBuffer(file)
    })
  }

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
    cleanup,
  }
}