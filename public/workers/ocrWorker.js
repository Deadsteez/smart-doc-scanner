console.log('[OCR Worker] Starting...')

importScripts('/tesseract/tesseract.min.js')

let currentLanguage = 'eng'
let scheduler       = null
let workerRef       = null   
let isInitializing  = false
let initQueue       = []

const DEFAULT_PARAMS = {
  tessedit_pageseg_mode:       '3',
  preserve_interword_spaces:   '1',
  tessedit_minimal_confidence: '30',
}

const AMOUNT_PARAMS = {
  tessedit_pageseg_mode:       '7',   // single text-line mode
  tessedit_char_whitelist:     '0123456789.,RrSs$₹',
  preserve_interword_spaces:   '1',
}

function mapDocType(raw) {
  switch ((raw ?? '').toLowerCase()) {
    case 'invoice':        return 'invoice'
    case 'receipt':        return 'receipt'
    case 'bank_statement':
    case 'bank statement':
    case 'bankstatement':  return 'bank_statement'
    default:               return 'other'
  }
}

async function getScheduler(language = 'eng') {
  if (scheduler && currentLanguage === language) return scheduler

  if (scheduler && currentLanguage !== language) {
    await scheduler.terminate()
    scheduler  = null
    workerRef  = null
  }

  currentLanguage = language

  if (isInitializing) {
    return new Promise((resolve, reject) => initQueue.push({ resolve, reject }))
  }

  isInitializing = true

  try {
    postMessage({ type: 'progress', progress: 0.05, status: 'Loading OCR engine...' })

    scheduler = Tesseract.createScheduler()

    const worker = await Tesseract.createWorker(language, 1, {
      langPath: self.location.origin + '/tesseract/lang-data',
      gzip: false,
      logger: message => {
        if (message.status === 'loading tesseract core') {
          postMessage({ type: 'progress', progress: 0.08, status: 'Loading OCR core...' })
        } else if (message.status === 'loading language traineddata') {
          const scaled = 0.1 + ((message.progress ?? 0) * 0.08)
          postMessage({
            type: 'progress',
            progress: parseFloat(scaled.toFixed(2)),
            status: `Loading language data... ${Math.round((message.progress ?? 0) * 100)}%`
          })
        }
      }
    })

    await worker.setParameters(DEFAULT_PARAMS)
    scheduler.addWorker(worker)
    workerRef = worker   
    postMessage({ type: 'progress', progress: 0.2, status: 'OCR engine ready' })

    initQueue.forEach(({ resolve }) => resolve(scheduler))
    initQueue = []

    console.log('[OCR Worker] Scheduler ready')
    return scheduler

  } catch (err) {
    scheduler  = null
    workerRef  = null
    initQueue.forEach(({ reject }) => reject(err))
    initQueue  = []
    throw err
  } finally {
    isInitializing = false
  }
}

async function loadBitmap(dataUrl) {
  const res  = await fetch(dataUrl)
  const blob = await res.blob()
  return createImageBitmap(blob)
}

async function cropRegion(bitmap, crop, scale = 2) {
  const sx = Math.max(0, Math.floor(bitmap.width  * crop.x))
  const sy = Math.max(0, Math.floor(bitmap.height * crop.y))
  const sw = Math.max(1, Math.floor(bitmap.width  * crop.width))
  const sh = Math.max(1, Math.floor(bitmap.height * crop.height))

 
  const safeScale = Math.min(scale, 4096 / Math.max(sw, sh))
  const outW      = Math.max(1, Math.floor(sw * safeScale))
  const outH      = Math.max(1, Math.floor(sh * safeScale))

  const canvas = new OffscreenCanvas(outW, outH)
  const ctx    = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH)
  return canvas
}

function estimateLuminance(canvas) {
  const ctx  = canvas.getContext('2d')
  const sw   = Math.min(80, canvas.width)
  const sh   = Math.min(80, canvas.height)
  const data = ctx.getImageData(0, 0, sw, sh).data
  let total  = 0, count = 0
  for (let i = 0; i < data.length; i += 4) {
    total += (data[i] ?? 0) * 0.299 + (data[i + 1] ?? 0) * 0.587 + (data[i + 2] ?? 0) * 0.114
    count++
  }
  return count ? total / count : 255
}

function binariseCanvas(canvas, { invert = false, threshold = 158 } = {}) {
  const ctx     = canvas.getContext('2d')
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d       = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    let g = (d[i] ?? 0) * 0.299 + (d[i + 1] ?? 0) * 0.587 + (d[i + 2] ?? 0) * 0.114
    g = g < threshold ? 0 : 255
    if (invert) g = 255 - g
    d[i] = d[i + 1] = d[i + 2] = g
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

function grayscaleCanvas(canvas, { invert = false, contrast = 1.45 } = {}) {
  const ctx     = canvas.getContext('2d')
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d       = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    let g = (d[i] ?? 0) * 0.299 + (d[i + 1] ?? 0) * 0.587 + (d[i + 2] ?? 0) * 0.114
    g = ((g - 128) * contrast) + 128
    g = Math.min(255, Math.max(0, g))
    if (invert) g = 255 - g
    d[i] = d[i + 1] = d[i + 2] = g
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas
}

function canvasToDataUrl(canvas, format = 'image/png') {
  return new Promise((resolve, reject) => {
    canvas.convertToBlob({ type: format })
      .then(blob => {
        const reader   = new FileReader()
        reader.onload  = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('canvasToDataUrl: FileReader failed'))
        reader.readAsDataURL(blob)
      })
      .catch(reject)
  })
}
function normaliseOcrText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/â‚¹/g, '₹')      // garbled UTF-8 rupee
    .replace(/\u20B9/g, '₹')   // Unicode rupee sign → consistent char
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}


function normaliseAmountText(text) {
  let s = normaliseOcrText(text)

  
  s = s.replace(/(?<!\d)\b2\s+(\d{2,4}(?:[,.]\d+)?)\b/g, '₹ $1')

  s = s.replace(/^2(\d{2,3})\b/gm, (match, digits) => {
    const full = parseInt('2' + digits, 10)
    if (full >= 2000 && full <= 2099) return match   // year
    if (full > 2200)                  return match   // large reference number
    return '₹' + digits
  })

  return s
}

function scoreText(text, confidence) {
  let score = confidence
  if (/₹|\br(?=\d)|rs|inr|\$/i.test(text))                                          score += 18
  if (/\b\d+(?:\.\d{1,2})\b/.test(text))                                             score += 8
  if (/paid|received|total|invoice|amount|completed|successful/i.test(text))         score += 8
  if (/invoice\s*(no|number|#)|receipt\s*(no|number|#)|transaction\s*id/i.test(text)) score += 5
  if (/opening\s*balance|closing\s*balance|account\s*statement/i.test(text))         score += 8
  if (/\b(neft|rtgs|imps|upi|ifsc)\b/i.test(text))                                   score += 5
  return score
}

function scoreAmountBandText(text, confidence) {
  let score = confidence
  if (/₹|\br(?=\d)|rs|inr|\$/i.test(text))                                          score += 24
  if (/\b\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?\b/.test(text))                          score += 18
  // A line that is *only* a money amount scores very highly
  if (/^\s*(?:₹|r|rs|\$)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)\s*$/i.test(text)) score += 28
  if (/total|amount|paid|invoice/i.test(text))                                        score += 4
  if (text.length <= 32)                                                               score += 6
  return score
}

function computeSimilarity(s1, s2) {
  const set1 = new Set(s1.toLowerCase().split(/\s+/).filter(w => w.length > 2))
  const set2 = new Set(s2.toLowerCase().split(/\s+/).filter(w => w.length > 2))
  if (set1.size === 0 && set2.size === 0) return s1.toLowerCase() === s2.toLowerCase() ? 1 : 0
  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])
  return intersection.size / (union.size || 1)
}

function mergeTexts(texts) {
  const merged = []
  const AD_KEYWORDS = /(?:cashback|win\s+up\s+to|scratch\s+card|pay\s+via|powered\s+by|download\s+app|ad\b|sponsor)/i

  for (const text of texts) {
    for (const line of normaliseOcrText(text).split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Filter ads immediately
      if (AD_KEYWORDS.test(trimmed)) continue

      // Quality gate — at least 35% of chars must be "useful"
      const useful = (trimmed.match(
        /[a-zA-Z0-9$₹.,:#\-\/\u0900-\u097F\u0600-\u06FF]/g
      ) ?? []).length
      if (useful / trimmed.length < 0.35) continue

      // Deduplication based on similarity (Jaccard > 0.65 or exact match)
      const isDuplicate = merged.some(m => {
        if (m.toLowerCase() === trimmed.toLowerCase()) return true
        if (trimmed.length > 10 && m.length > 10) {
          return computeSimilarity(m, trimmed) > 0.65
        }
        return false
      })

      if (isDuplicate) continue
      merged.push(trimmed)
    }
  }

  return merged.join('\n')
}

function extractLikelyAmount(text) {
  const norm = normaliseAmountText(text)

  const exactLine = norm.split('\n').map(l => l.trim()).find(l =>
    /^(?:₹|rs\.?|inr|\$)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)$/i.test(l)
  )
  if (exactLine) {
    const m = exactLine.match(/(\d[\d,.]*)/)
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, ''))
      if (isFinite(v) && v > 0 && v <= 1000000) return v
    }
  }

  // Fall back to first currency-prefixed number
  const m = norm.match(/(?:₹|rs\.?|inr|\$)\s*([\d,]+(?:\.\d{1,2})?)/i)
  if (m) {
    const v = parseFloat(m[1].replace(/,/g, ''))
    if (isFinite(v) && v > 0 && v <= 1000000) return v
  }

  return null
}

function getDocumentTypeCrops(docType) {
  switch (docType) {
    case 'invoice':
      return [
        { x: 0.0,  y: 0.0,  width: 0.65, height: 0.30, scale: 3.5, label: 'invoice-header' },
        { x: 0.55, y: 0.0,  width: 0.45, height: 0.25, scale: 3.8, label: 'invoice-ref'    },
        { x: 0.0,  y: 0.28, width: 1.0,  height: 0.45, scale: 2.8, label: 'invoice-items'  },
        { x: 0.45, y: 0.70, width: 0.55, height: 0.30, scale: 4.5, label: 'invoice-total'  },
      ]

    case 'receipt':
      return [
        { x: 0.0, y: 0.0,  width: 1.0, height: 0.25, scale: 3.5, label: 'receipt-header' },
        { x: 0.0, y: 0.20, width: 1.0, height: 0.55, scale: 2.5, label: 'receipt-body'   },
        { x: 0.0, y: 0.68, width: 1.0, height: 0.32, scale: 4.0, label: 'receipt-total'  },
      ]

    case 'bank_statement':
      return [
        { x: 0.0, y: 0.0,  width: 1.0, height: 0.20, scale: 3.0, label: 'stmt-header' },
        { x: 0.0, y: 0.18, width: 1.0, height: 0.65, scale: 2.5, label: 'stmt-body'   },
        { x: 0.0, y: 0.78, width: 1.0, height: 0.22, scale: 3.0, label: 'stmt-footer' },
      ]

    case 'utility_bill':
      return [
        { x: 0.0,  y: 0.0,  width: 1.0,  height: 0.30, scale: 3.0, label: 'util-header' },
        { x: 0.40, y: 0.0,  width: 0.60, height: 0.35, scale: 3.5, label: 'util-details' },
        { x: 0.0,  y: 0.30, width: 1.0,  height: 0.50, scale: 2.5, label: 'util-body' },
      ]

    default:
      return [
        { x: 0.0, y: 0.0,  width: 1.0, height: 0.55, scale: 2.6, label: 'top-generic'    },
        { x: 0.0, y: 0.45, width: 1.0, height: 0.55, scale: 2.6, label: 'bottom-generic' },
      ]
  }
}

function getAmountBandCrops(docType) {
  switch (docType) {
    case 'invoice':
      return [
        { x: 0.40, y: 0.72, width: 0.60, height: 0.08, scale: 5.5, label: 'inv-amount-1' },
        { x: 0.38, y: 0.76, width: 0.62, height: 0.09, scale: 5.5, label: 'inv-amount-2' },
        { x: 0.35, y: 0.80, width: 0.65, height: 0.09, scale: 6.0, label: 'inv-amount-3' },
        { x: 0.30, y: 0.84, width: 0.70, height: 0.10, scale: 6.0, label: 'inv-amount-4' },
        { x: 0.25, y: 0.88, width: 0.75, height: 0.10, scale: 6.5, label: 'inv-amount-5' },
      ]

    case 'receipt':
      return [
        { x: 0.20, y: 0.70, width: 0.60, height: 0.07, scale: 5.5, label: 'rec-amount-1' },
        { x: 0.18, y: 0.74, width: 0.64, height: 0.08, scale: 5.5, label: 'rec-amount-2' },
        { x: 0.15, y: 0.78, width: 0.70, height: 0.09, scale: 6.0, label: 'rec-amount-3' },
        { x: 0.10, y: 0.82, width: 0.80, height: 0.09, scale: 6.0, label: 'rec-amount-4' },
        { x: 0.05, y: 0.86, width: 0.90, height: 0.10, scale: 6.5, label: 'rec-amount-5' },
      ]

    case 'bank_statement':
      // Balance column is typically right-aligned
      return [
        { x: 0.60, y: 0.18, width: 0.40, height: 0.65, scale: 3.5, label: 'stmt-amount-col'   },
        { x: 0.55, y: 0.75, width: 0.45, height: 0.12, scale: 5.0, label: 'stmt-amount-foot'  },
        { x: 0.50, y: 0.80, width: 0.50, height: 0.12, scale: 5.0, label: 'stmt-amount-foot2' },
      ]

    case 'utility_bill':
      return [
        { x: 0.30, y: 0.20, width: 0.70, height: 0.40, scale: 4.0, label: 'util-amount-top' },
        { x: 0.20, y: 0.60, width: 0.80, height: 0.25, scale: 5.0, label: 'util-amount-bot' },
      ]

    default:
      return [
        { x: 0.30, y: 0.65, width: 0.70, height: 0.10, scale: 5.0, label: 'gen-amount-1' },
        { x: 0.25, y: 0.72, width: 0.75, height: 0.10, scale: 5.0, label: 'gen-amount-2' },
        { x: 0.20, y: 0.78, width: 0.80, height: 0.10, scale: 5.5, label: 'gen-amount-3' },
      ]
  }
}

async function prepareBaseVariants(imageDataUrl) {
  const bitmap   = await loadBitmap(imageDataUrl)
  const variants = []

  // 1. Full image — grayscale, contrast-boosted
  {
    const canvas = await cropRegion(bitmap, { x: 0, y: 0, width: 1, height: 1 }, 2)
    grayscaleCanvas(canvas, { contrast: 1.45, invert: estimateLuminance(canvas) < 128 })
    variants.push({ label: 'full-grayscale', imageData: await canvasToDataUrl(canvas) })
  }

  // 2. Full image — binarised (black/white)
  {
    const canvas = await cropRegion(bitmap, { x: 0, y: 0, width: 1, height: 1 }, 2)
    const lum    = estimateLuminance(canvas)
    binariseCanvas(canvas, { invert: lum < 128, threshold: lum < 128 ? 120 : 165 })
    variants.push({ label: 'full-binary', imageData: await canvasToDataUrl(canvas) })
  }

  // 3. Explicit invert — catches white-on-dark layouts
  {
    const canvas = await cropRegion(bitmap, { x: 0, y: 0, width: 1, height: 1 }, 2)
    binariseCanvas(canvas, { invert: true, threshold: 120 })
    variants.push({ label: 'full-inverted', imageData: await canvasToDataUrl(canvas) })
  }

  // 4. Top 55% — header / vendor / reference fields (extra upscale)
  {
    const canvas = await cropRegion(bitmap, { x: 0, y: 0, width: 1, height: 0.55 }, 2.6)
    binariseCanvas(canvas, { invert: estimateLuminance(canvas) < 128, threshold: 168 })
    variants.push({ label: 'top-binary', imageData: await canvasToDataUrl(canvas) })
  }

  // 5. Bottom 50% — totals / footer row (extra upscale)
  {
    const canvas = await cropRegion(bitmap, { x: 0, y: 0.5, width: 1, height: 0.5 }, 2.6)
    binariseCanvas(canvas, { invert: estimateLuminance(canvas) < 128, threshold: 168 })
    variants.push({ label: 'bottom-binary', imageData: await canvasToDataUrl(canvas) })
  }

  return variants
}

async function prepareDocumentRegionVariants(imageDataUrl, docType) {
  const crops    = getDocumentTypeCrops(docType)
  if (!crops.length) return []

  const bitmap   = await loadBitmap(imageDataUrl)
  const variants = []

  for (const crop of crops) {
    // Measure luminance from a 1× crop (cheap, unmodified)
    const lumCanvas = await cropRegion(bitmap, crop, 1)
    const lum       = estimateLuminance(lumCanvas)

    // Binarised variant — fresh crop
    const bin = await cropRegion(bitmap, crop, crop.scale ?? 2)
    binariseCanvas(bin, { invert: lum < 150, threshold: lum < 150 ? 120 : 170 })
    variants.push({ label: `${crop.label}-binary`, imageData: await canvasToDataUrl(bin) })

    // Dark backgrounds also get an explicit hard-invert variant
    if (lum < 150) {
      const inv = await cropRegion(bitmap, crop, crop.scale ?? 2)  // ← fresh crop
      binariseCanvas(inv, { invert: true, threshold: 126 })
      variants.push({ label: `${crop.label}-inverted`, imageData: await canvasToDataUrl(inv) })
    }
  }

  return variants
}

async function prepareAmountBandVariants(imageDataUrl, docType) {
  const bands    = getAmountBandCrops(docType)
  if (!bands.length) return []

  const bitmap   = await loadBitmap(imageDataUrl)
  const variants = []

  for (const band of bands) {
    // Luminance sample from 1× — cheap
    const lumCanvas = await cropRegion(bitmap, band, 1)
    const lum       = estimateLuminance(lumCanvas)

    // Grayscale high-contrast — fresh crop
    const gray = await cropRegion(bitmap, band, band.scale ?? 5)
    grayscaleCanvas(gray, { invert: lum < 160, contrast: 1.7 })
    variants.push({ label: `${band.label}-grayscale`, imageData: await canvasToDataUrl(gray) })

    // Binary — fresh crop
    const bin = await cropRegion(bitmap, band, band.scale ?? 5)
    binariseCanvas(bin, { invert: lum < 160, threshold: lum < 160 ? 132 : 176 })
    variants.push({ label: `${band.label}-binary`, imageData: await canvasToDataUrl(bin) })

    // Hard-invert — fresh crop (catches amounts on coloured badge backgrounds)
    const inv = await cropRegion(bitmap, band, band.scale ?? 5)
    binariseCanvas(inv, { invert: true, threshold: 132 })
    variants.push({ label: `${band.label}-inverted`, imageData: await canvasToDataUrl(inv) })
  }

  return variants
}

async function runVariants(sched, variants, mode = 'default', earlyExitFn) {
  const results = []

  // Apply mode-specific Tesseract parameters before the loop
  if (workerRef) {
    await workerRef.setParameters(
      mode === 'amount' ? AMOUNT_PARAMS : DEFAULT_PARAMS
    )
  }

  try {
    for (let vi = 0; vi < variants.length; vi++) {
      const variant = variants[vi]
      try {
        const result     = await sched.addJob('recognize', variant.imageData)
        const rawText    = result.data.text ?? ''
        const text       = mode === 'amount'
          ? normaliseAmountText(rawText)
          : normaliseOcrText(rawText)
        const confidence = result.data.confidence ?? 0
        const score      = mode === 'amount'
          ? scoreAmountBandText(text, confidence)
          : scoreText(text, confidence)

        results.push({ label: variant.label, text, confidence, score })

       
        if (vi >= 1 && earlyExitFn && earlyExitFn(text, score)) {
          console.log(`[OCR Worker] Early exit triggered on variant: ${variant.label}`)
          break
        }
      } catch (err) {
        console.warn(`[OCR Worker] Variant ${variant.label} failed:`, err)
      }
    }
  } finally {
    // Always restore DEFAULT_PARAMS so subsequent passes aren't affected
    if (workerRef && mode === 'amount') {
      await workerRef.setParameters(DEFAULT_PARAMS)
    }
  }

  return results
}

function buildFilteredText(words, lines) {
  const CONFIDENCE_THRESHOLD = 55
  const lineMap = new Map()

  for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
    const word = words[wordIdx]
    if (!word.text?.trim()) continue

    let lineIdx = -1
    for (let i = 0; i < lines.length; i++) {
      const lineWords = lines[i].words ?? []
      for (let j = 0; j < lineWords.length; j++) {
        if (lineWords[j] === word) { lineIdx = i; break }
      }
      if (lineIdx >= 0) break
    }
    const key = lineIdx >= 0 ? lineIdx : Math.round((word.bbox?.y0 ?? 0) / 20)
    if (!lineMap.has(key)) lineMap.set(key, [])
    lineMap.get(key).push(word.confidence >= CONFIDENCE_THRESHOLD ? word.text : '')
  }

  return [...lineMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, ws]) => ws.filter(Boolean).join(' '))
    .filter(l => l.trim())
    .join('\n')
}

function scoreParsedAmountCandidate(result, bandIndex) {
  const norm  = normaliseAmountText(result.text)
  const lines = norm.split('\n').map(l => l.trim()).filter(Boolean)

  const exactLine = lines.find(l =>
    /^(?:₹|rs\.?|inr|\$)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d{1,6}(?:\.\d{1,2})?)$/i.test(l)
  ) ?? ''

  const amount = extractLikelyAmount(norm)
  if (amount === null) return null

  let score = result.score
  // Band position bonus: bands nearer to the expected total zone score higher
  score += Math.max(0, 20 - Math.abs((bandIndex ?? 3) - 3) * 4)

  if (exactLine)                                                                    score += 34
  if (/^(?:₹|rs\.?|inr|\$)/i.test(exactLine))                                     score += 26
  if (lines.length === 1)                                                           score += 12
  if (lines.length > 2)                                                             score -= 14
  if (/^\d{1,2}$/.test(exactLine || norm))                                         score -= 18   // single/double digit — unlikely total
  if (amount < 100 && !/^(?:₹|rs\.?|inr|\$)/i.test(exactLine))                   score -= 8
  if (/\b\d{7,}\b/.test(norm))                                                      score -= 20  // looks like a reference/phone number
  if (norm.replace(/\b(?:rs|inr)\b/gi, '').replace(/[₹\d\s.,]/g, '').match(/[A-Za-z]{2,}/)) score -= 20
  if ((exactLine || norm).length <= 8)                                              score += 10

  return { amount, text: norm, label: result.label, confidence: result.confidence, score }
}

onmessage = async (e) => {
  const {
    image,
    language = 'eng',
    docType: rawDocType = 'other',
    mode    = 'full',
  } = e.data

  const docType = mapDocType(rawDocType)

  if (!image) {
    postMessage({ type: 'error', error: 'No image provided' })
    return
  }

  console.log(`[OCR Worker] Request — mode:${mode} docType:${docType} lang:${language}`)

  try {
    const sched = await getScheduler(language)

   
    if (mode === 'full') {
      postMessage({ type: 'progress', progress: 0.25, status: 'Preparing image variants...' })

      const variants = await prepareBaseVariants(image)

      postMessage({ type: 'progress', progress: 0.35, status: 'Recognizing text...' })

      const results    = await runVariants(sched, variants)
      const sorted     = [...results].sort((a, b) => b.score - a.score)
      const mergedText = mergeTexts(sorted.map(r => r.text))

      postMessage({ type: 'progress', progress: 0.85, status: 'Merging results...' })

      let finalText = mergedText
      const bestVariant = variants.find(v => v.label === sorted[0]?.label)
      if (bestVariant && mergedText.length > 0) {
        try {
          const rawBest = await sched.addJob('recognize', bestVariant.imageData)
          const words   = rawBest?.data?.words ?? []
          const lines   = rawBest?.data?.lines ?? []
          if (words.length > 0) {
            const filteredText = buildFilteredText(words, lines)
            // Use whichever is more complete
            if (filteredText.length > 0 && filteredText.length > mergedText.length) {
              finalText = filteredText
            }
          }
        } catch (filterErr) {
          console.warn('[OCR Worker] Filtered-text fallback failed, using merged:', filterErr)
        }
      }

      postMessage({ type: 'progress', progress: 1.0, status: 'Done' })

      postMessage({
        type:         'result',
        text:         finalText,
        rawText:      sorted[0]?.text ?? '',
        confidence:   Math.max(...results.map(r => r.confidence), 0),
        words:        [],   // words from all variants would be enormous; omit
        variantCount: results.length,
      })
    }

    else if (mode === 'region') {
      postMessage({ type: 'progress', progress: 0.1, status: 'Preparing region crops...' })

      const regionVariants = await prepareDocumentRegionVariants(image, docType)
      const amountVariants = await prepareAmountBandVariants(image, docType)

      postMessage({ type: 'progress', progress: 0.3, status: 'Running region OCR...' })

      const regionResults = regionVariants.length
        ? await runVariants(sched, regionVariants)
        : []

      postMessage({ type: 'progress', progress: 0.6, status: 'Running amount-band OCR...' })

      // Amount-band pass — uses AMOUNT_PARAMS (FIX 1 lands here via runVariants)
      const amountResults = amountVariants.length
        ? await runVariants(sched, amountVariants, 'amount', (text, score) => {
            const norm         = normaliseAmountText(text)
            const hasCleanLine = norm.split('\n').some(l =>
              /^(?:₹|rs\.?|inr|\$)\s*\d[\d,]*(?:\.\d{1,2})?$/i.test(l.trim())
            )
            // Early exit only after 2nd variant (FIX 4 is inside runVariants)
            return score >= 120 && extractLikelyAmount(norm) !== null && hasCleanLine
          })
        : []

      // Score amount candidates and pick the best
      const amountCandidates = amountResults
        .map((r, i) => scoreParsedAmountCandidate(r, i))
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)

      const bestAmount = amountCandidates[0]?.amount ?? null

      // Take the top-2 candidates that are within 18 points of the winner
      const amountTexts = bestAmount
        ? amountCandidates
            .filter(c => c.score >= (amountCandidates[0].score - 18))
            .slice(0, 2)
            .map(c => c.text)
        : []
      const mergedRegion = mergeTexts([
        bestAmount ? `Amount ₹${bestAmount}` : '',
        ...regionResults.map(r => r.text),
        ...amountTexts,
      ].filter(Boolean))

      postMessage({ type: 'progress', progress: 1.0, status: 'Done' })

      postMessage({
        type:           'result',
        text:           mergedRegion,
        rawText:        mergedRegion,
        confidence:     Math.max(
          ...regionResults.map(r => r.confidence),
          ...amountResults.map(r => r.confidence),
          0
        ),
        detectedAmount: bestAmount,
        words:          [],
        isRegionPass:   true,
      })
    }

  } catch (err) {
    console.error('[OCR Worker] Error:', err)
    postMessage({ type: 'error', error: String(err) })
  }
}