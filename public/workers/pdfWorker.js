// Converts PDF pages to images inside a dedicated worker for OCR pipeline
console.log('[PDF Worker] Starting...')

// load pdf.js worker-safe bundles
importScripts('/pdfjs/pdf.worker.min.js')
importScripts('/pdfjs/pdf.min.js')

// Prevent nested worker creation
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''
}

self.onmessage = async (e) => {
  const { pdfData, options = {} } = e.data

  if (!pdfData) {
    self.postMessage({ type: 'error', error: 'no_pdf', detail: 'No PDF data provided' })
    return
  }

  try {
    console.log('[PDF Worker] Processing PDF...')

    const {
      maxPages = 10,
      scale = 2.0,
      outputFormat = 'png'
    } = options

    self.postMessage({
      type: 'progress',
      progress: 0.1,
      status: 'Loading PDF document...'
    })

    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      disableFontFace: true,
      useSystemFonts: true,
      isEvalSupported: false,
    })

    const pdf = await loadingTask.promise
    const numPages = Math.min(pdf.numPages, maxPages)

    console.log(`[PDF Worker] ${pdf.numPages} pages, processing ${numPages}`)

    self.postMessage({
      type: 'progress',
      progress: 0.2,
      status: `Converting ${numPages} pages to images...`,
      totalPages: numPages
    })

    const pages = []

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale })

        const canvas = new OffscreenCanvas(viewport.width, viewport.height)
        const context = canvas.getContext('2d')

        await page.render({
          canvasContext: context,
          viewport
        }).promise

        const blob = await canvas.convertToBlob({
          type: `image/${outputFormat}`
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

        const progress = 0.2 + (pageNum / numPages) * 0.7
        
        self.postMessage({
          type: 'progress',
          progress,
          status: `Converted page ${pageNum}/${numPages}`,
          currentPage: pageNum,
          totalPages: numPages
        })

        page.cleanup()

      } catch (pageError) {
        console.error(`[PDF Worker] Page ${pageNum} error:`, pageError)
        pages.push({ pageNumber: pageNum, error: pageError.message })
      }
    }

    pdf.destroy()

    console.log(`[PDF Worker] Done: ${pages.filter(p => !p.error).length}/${numPages} pages`)

    self.postMessage({
      type: 'result',
      pages,
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