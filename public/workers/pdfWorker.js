// PDF processing worker - converts PDF pages to images for OCR

console.log('[PDF Worker] Starting...')

// Use locally installed pdfjs-dist served from /public/pdfjs/
importScripts('/pdfjs/pdf.min.js')

// In a Web Worker, there is no 'document', so we must disable the
// fake worker and point directly to the worker script
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'

// Disable the fake worker fallback which tries to use 'document'
pdfjsLib.GlobalWorkerOptions.workerPort = null

self.onmessage = async (e) => {
  const { pdfData, options = {} } = e.data
  
  if (!pdfData) {
    self.postMessage({ error: 'no_pdf', detail: 'No PDF data provided' })
    return
  }

  try {
    console.log('[PDF Worker] Processing PDF...')
    
    // Default options
    const {
      maxPages = 10,        // Limit pages to prevent memory issues
      scale = 2.0,          // Higher scale for better OCR accuracy
      outputFormat = 'png'  // PNG for better OCR than JPEG
    } = options

    self.postMessage({ 
      type: 'progress', 
      progress: 0.1, 
      status: 'Loading PDF document...' 
    })

    // Load PDF document - pdfData is already ArrayBuffer
    const pdf = await pdfjsLib.getDocument({ 
      data: pdfData,
      // Disable font loading to speed up processing
      disableFontFace: true,
      // Use system fonts
      useSystemFonts: true
    }).promise

    const numPages = Math.min(pdf.numPages, maxPages)
    console.log(`[PDF Worker] PDF has ${pdf.numPages} pages, processing ${numPages}`)

    self.postMessage({ 
      type: 'progress', 
      progress: 0.2, 
      status: `Converting ${numPages} pages to images...`,
      totalPages: numPages
    })

    const pages = []

    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        
        // Get page dimensions
        const viewport = page.getViewport({ scale })
        
        // Create canvas
        const canvas = new OffscreenCanvas(viewport.width, viewport.height)
        const context = canvas.getContext('2d')
        
        // Render page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise

        // Convert to image data URL
        const blob = await canvas.convertToBlob({ 
          type: `image/${outputFormat}`,
          quality: outputFormat === 'jpeg' ? 0.95 : undefined
        })
        
        const reader = new FileReader()
        const dataUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        })

        pages.push({
          pageNumber: pageNum,
          image: dataUrl,
          width: viewport.width,
          height: viewport.height
        })

        // Update progress
        const progress = 0.2 + (pageNum / numPages) * 0.7
        self.postMessage({ 
          type: 'progress', 
          progress, 
          status: `Converted page ${pageNum}/${numPages}`,
          currentPage: pageNum
        })

        // Clean up page
        page.cleanup()

      } catch (pageError) {
        console.error(`[PDF Worker] Error processing page ${pageNum}:`, pageError)
        // Continue with other pages
        pages.push({
          pageNumber: pageNum,
          error: pageError.message
        })
      }
    }

    // Clean up PDF document
    pdf.destroy()

    console.log(`[PDF Worker] Successfully converted ${pages.filter(p => !p.error).length}/${numPages} pages`)

    self.postMessage({
      type: 'result',
      pages: pages,
      totalPages: numPages,
      successfulPages: pages.filter(p => !p.error).length
    })

  } catch (err) {
    console.error('[PDF Worker] Error:', err)
    self.postMessage({ 
      type: 'error', 
      error: 'pdf_processing_failed', 
      detail: String(err) 
    })
  }
}

// Handle worker errors
self.onerror = (err) => {
  console.error('[PDF Worker] Worker error:', err)
  self.postMessage({ 
    type: 'error', 
    error: 'worker_error', 
    detail: String(err) 
  })
}