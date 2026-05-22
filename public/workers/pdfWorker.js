console.log('[PDF Worker] Starting...')

importScripts('/pdfjs/pdf.worker.min.js')
importScripts('/pdfjs/pdf.min.js')

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''
}

const VALID_FORMATS = ['png', 'jpeg', 'webp']
const MAX_CANVAS_DIM = 4096

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
    } = options

    const outputFormat = VALID_FORMATS.includes(options.outputFormat)
      ? options.outputFormat
      : 'png'

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

    try
    {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale })

       const safeScale = Math.min(
            scale,
            MAX_CANVAS_DIM / Math.max(viewport.width, viewport.height)
          )
          const safeViewport = page.getViewport({ scale: safeScale })
 
          const canvas = new OffscreenCanvas(safeViewport.width, safeViewport.height)
          const context = canvas.getContext('2d')

          context.clearRect(0, 0, canvas.width, canvas.height)
 
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

       const pageResult = {
            pageNumber: pageNum,
            image: dataUrl,
            width: safeViewport.width,
            height: safeViewport.height
          }
 
          pages.push(pageResult)
        
       self.postMessage({ type: 'page', page: pageResult })
 
          const progress = 0.2 + (pageNum / numPages) * 0.75
          self.postMessage({
            type: 'progress',
            progress: parseFloat(progress.toFixed(2)),
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
  }
  finally{
    pdf.destroy()
  }
   const successfulPages = pages.filter(p => !p.error).length
    console.log(`[PDF Worker] Done: ${successfulPages}/${numPages} pages`)

    self.postMessage({ type: 'progress', progress: 1.0, status: 'Done' })
 
    self.postMessage({
      type: 'result',
      pages,
      totalPages: numPages,
      successfulPages
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
