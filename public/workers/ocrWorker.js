
// Tesseract.js worker — persistent scheduler, LSTM-only, tuned params

console.log('[OCR Worker] Starting...')

importScripts('/tesseract/tesseract.min.js')

// Create the scheduler ONCE and reuse it for every message.
// The old approach called Tesseract.recognize() directly which spins up
// a brand new worker + loads the LSTM model on every single call (~3-8s overhead).
// With a persistent scheduler the model loads once (~1-2s) and subsequent
// recognitions take ~300-800ms.
let currentLanguage = 'eng'
let scheduler = null
let isInitializing = false
let initQueue = []

async function getScheduler(language = 'eng') {
  // If language changed, recreate scheduler
  if (scheduler && currentLanguage !== language) {
    await scheduler.terminate()
    scheduler = null
  }
  
  if (scheduler && currentLanguage === language) return scheduler
  
  currentLanguage = language
  

  // If init is in progress, wait for it
  if (isInitializing) {
    return new Promise((resolve) => initQueue.push(resolve))
  }

  isInitializing = true

  postMessage({ type: 'progress', progress: 0.05, status: 'Loading OCR engine...' })

  scheduler = Tesseract.createScheduler()

  const worker = await Tesseract.createWorker(language, 1, {
    langPath: self.location.origin + '/tesseract/lang-data',
    gzip: false,
    logger: m => {
      if (m.status === 'loading tesseract core' || m.status === 'loading language traineddata') {
        postMessage({ type: 'progress', progress: 0.1, status: m.status })
      }
    }
  })

  await worker.setParameters({
    // PSM 3 = fully automatic — best for mixed layouts
    tessedit_pageseg_mode: '3',
    preserve_interword_spaces: '1',
    tessedit_minimal_confidence: '30',
  })

  scheduler.addWorker(worker)

  postMessage({ type: 'progress', progress: 0.2, status: 'OCR engine ready' })

  // Resolve any queued callers
  initQueue.forEach(resolve => resolve(scheduler))
  initQueue = []
  isInitializing = false

  console.log('[OCR Worker] Scheduler ready')
  return scheduler
}

onmessage = async (e) => {
  const { image, language = 'eng' } = e.data
  
  if (!image) {
    postMessage({ type: 'error', error: 'No image provided' })
    return
  }

  console.log('[OCR Worker] Recognition request received')

  try {
    const sched = await getScheduler(language)

    postMessage({ type: 'progress', progress: 0.25, status: 'Recognizing text...' })

    const result = await sched.addJob('recognize', image)

    postMessage({ type: 'progress', progress: 0.95, status: 'Processing results...' })

    // Filter low-confidence words 
    // Reconstruct text from word-level data, dropping garbage words
    let filteredText = result.data.text

    if (result.data.words?.length) {
      filteredText = buildFilteredText(result.data.words, result.data.lines)
    }

    console.log(`[OCR Worker] Done. Confidence: ${result.data.confidence?.toFixed(1)}%`)

    postMessage({
      type: 'result',
      text: filteredText,
      rawText: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words?.map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox
      }))
    })

  } catch (err) {
    console.error('[OCR Worker] Error:', err)
    postMessage({ type: 'error', error: String(err) })
  }
}

// Build filtered text from word confidence data 
// Drops words below confidence threshold and reconstructs clean text
function buildFilteredText(words, lines) {
  const CONFIDENCE_THRESHOLD = 40

  // Group words back into lines using their line index
  const lineMap = new Map()

  for (const word of words) {
    if (!word.text?.trim()) continue

    const lineIdx = lines?.findIndex(l =>
      l.words?.some(w => w.text === word.text && w.bbox?.x0 === word.bbox?.x0)
    ) ?? -1

    const key = lineIdx >= 0 ? lineIdx : Math.round(word.bbox?.y0 / 20)

    if (!lineMap.has(key)) lineMap.set(key, [])

    lineMap.get(key).push(
      word.confidence >= CONFIDENCE_THRESHOLD ? word.text : ''
    )
  }

  // Sort lines top-to-bottom and join
  return [...lineMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, words]) => words.filter(Boolean).join(' '))
    .filter(line => line.trim())
    .join('\n')
}