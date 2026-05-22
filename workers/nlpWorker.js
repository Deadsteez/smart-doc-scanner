console.log('[NLP Worker] Starting...')

let nerPipeline = null
let classifierPipeline = null
let initPromise = null

async function initializeWorker() {
  try {
    console.log('[NLP Worker] Attempting to import transformers...')
    const { pipeline, env } = await import('@xenova/transformers')
    console.log('[NLP Worker] Transformers imported successfully')

    env.localModelPath = '/models/'
    env.cacheDir = '/models/'
    env.allowRemoteModels = true
    env.allowLocalModels = false

    console.log('[NLP Worker] Model path:', env.localModelPath)

    const MODEL_OPTIONS = { quantized: true }

    await loadPipelines(pipeline, MODEL_OPTIONS)

  } catch (importError) {
    console.error('[NLP Worker] Failed to import transformers:', importError)
    postMessage({
      type: 'error',
      error: 'Failed to load NLP dependencies: ' + String(importError)
    })
    throw importError
  }
}

async function loadPipelines(pipeline, MODEL_OPTIONS) {
  try {
    postMessage({
      type: 'progress',
      stage: 'ner',
      progress: 0.1,
      status: 'Loading NER model...'
    })

    nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER', {
      ...MODEL_OPTIONS,
      aggregation_strategy: 'simple',
      progress_callback: (p) => {
        if (p.status === 'downloading') {
          const scaled = 0.1 + ((p.progress ?? 0) / 100) * 0.25
          postMessage({
            type: 'progress',
            stage: 'ner',
            progress: parseFloat(scaled.toFixed(2)),
            status: `Downloading NER... ${p.progress?.toFixed(0) ?? ''}%`
          })
        } else if (p.status === 'loading') {
          postMessage({
            type: 'progress',
            stage: 'ner',
            progress: 0.35,
            status: 'Loading NER model...'
          })
        }
      }
    })

    postMessage({
      type: 'progress',
      stage: 'classifier',
      progress: 0.5,
      status: 'Loading classifier...'
    })

    classifierPipeline = await pipeline(
      'zero-shot-classification',
      'Xenova/nli-deberta-v3-small',
      {
        ...MODEL_OPTIONS,
        progress_callback: (p) => {
          if (p.status === 'downloading') {
            const scaled = 0.5 + ((p.progress ?? 0) / 100) * 0.35
            postMessage({
              type: 'progress',
              stage: 'classifier',
              progress: parseFloat(scaled.toFixed(2)),
              status: `Downloading classifier... ${p.progress?.toFixed(0) ?? ''}%`
            })
          } else if (p.status === 'loading') {
            postMessage({
              type: 'progress',
              stage: 'classifier',
              progress: 0.85,
              status: 'Loading classifier...'
            })
          }
        }
      }
    )

    postMessage({
      type: 'progress',
      stage: 'ready',
      progress: 1,
      status: 'NLP ready'
    })

  } catch (err) {
    console.error('[NLP Worker] Model load failed:', err)
    postMessage({
      type: 'error',
      error: 'Failed to load NLP models: ' + String(err)
    })
  }
}

// Preload models when worker starts to reduce latency after OCR completes
initPromise = initializeWorker()

// Handle messages from main thread
self.onmessage = async (e) => {
  const { text, cvFeatures } = e.data

  if (!text?.trim()) {
    postMessage({ type: 'error', error: 'No text provided' })
    return
  }

  try {
    await initPromise
  } catch {
    postMessage({ type: 'error', error: 'Worker failed to initialize — reload and try again' })
    return
  }

  if (!nerPipeline || !classifierPipeline) {
    throw new Error('Pipelines not initialized after init')
  }

  try {
    postMessage({
      type: 'progress',
      stage: 'ner',
      progress: 0.3,
      status: 'Extracting fields...'
    })
    const truncated = text.slice(0, 2000)

    const entities = await nerPipeline(truncated)
    const extracted = extractFields(text, entities)

    postMessage({
      type: 'progress',
      stage: 'classifier',
      progress: 0.7,
      status: 'Classifying document...'
    })

    const classLabels = [
      'invoice',
      'receipt',
      'bank statement',
      'payment slip',
      'utility bill',
      'tax document',
      'contract',
      'other'
    ]

    const classResult = await classifierPipeline(truncated, classLabels)
    const category = combineClassification(classResult, cvFeatures)

    postMessage({
      type: 'result',
      extracted,
      category,
      entities: entities.map((e) => ({
        word: e.word,
        label: e.entity_group ?? e.entity,
        score: e.score
      }))
    })

  } catch (err) {
    console.error('[NLP Worker] Job error:', err)
    postMessage({ type: 'error', error: String(err) })
  }
}

function extractFields(text, entities) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  const orgEntities = entities
    .filter((e) => (e.entity_group ?? e.entity) === 'ORG' && e.score > 0.7)
    .sort((a, b) => b.score - a.score)

  const vendor = orgEntities[0]?.word ?? fallbackVendor(lines)

  const dateEntity = entities.find(
    (e) => ['DATE', 'TIME'].includes(e.entity_group ?? e.entity) && e.score > 0.6
  )

  const moneyEntities = entities
    .filter((e) => (e.entity_group ?? e.entity) === 'MONEY' && e.score > 0.6)
    .map((e) => ({
      word: e.word,
      num: parseFloat(e.word.replace(/[^0-9.]/g, ''))
    }))
    .filter((e) => !isNaN(e.num))
    .sort((a, b) => b.num - a.num)

  return {
    vendor: vendor?.trim(),
    date: (dateEntity?.word ?? fallbackDate(text))?.trim(),
    total: (moneyEntities[0]?.word ?? fallbackTotal(text))?.trim(),
    tax: fallbackTax(text)?.trim(),
    receiptNumber: fallbackReceiptNumber(text)?.trim(),
    paymentMethod: fallbackPaymentMethod(text)?.trim(),
    items: extractLineItems(lines)
  }
}

function fallbackVendor(lines) {
  return lines.slice(0, 5).find((l) => l.length > 3 && !/^\d/.test(l))
}

function fallbackDate(text) {
  return (
    text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/) ||
    text.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i) ||
    text.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i)
  )?.[1]
}

function fallbackTotal(text) {
  return text.match(
    /\b(?:total|grand\s*total|amount\s*due|payable|balance\s*due)[^\d]*?([\d,]+\.?\d{0,2})/i
  )?.[1]
}

function fallbackTax(text) {
  return text.match(/\b(?:tax|gst|vat|hst|pst)[^\d]*?([\d,]+\.?\d{0,2})/i)?.[1]
}

function fallbackReceiptNumber(text) {
  // UTR / RRN — 12-digit bank reference
  const utr = text.match(/\b(?:UTR|RRN)\s*[:\-]?\s*([0-9]{12})\b/i)?.[1]
  if (utr) return utr

  // GST invoice number
  const gst = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/)?.[1]
  if (gst) return gst

  // E-way bill — 12 digits preceded by label
  const eway = text.match(/\be[-\s]?way\s*bill\s*(?:no|number)?[:\s]*([0-9]{12})\b/i)?.[1]
  if (eway) return eway

  // Generic receipt/invoice/ref number
  return text.match(
    /\b(?:receipt|invoice|order|ref|transaction|txn|trans)\s*(?:no\.?|#|number|id)?[:\s]*([A-Z0-9\-]{3,20})/i
  )?.[1]
}

function fallbackPaymentMethod(text) {
  return text.match(
    /\b(cash|visa|mastercard|amex|american\s*express|discover|debit|credit|upi|neft|rtgs|cheque|check|net\s*banking)\b/i
  )?.[1]
}

function extractLineItems(lines) {
  const items = []
  const itemPattern = /^(.+?)\s{2,}(\d+\.?\d{0,2})$|^(.+?)\s+\$?([\d,]+\.?\d{0,2})$/

  for (const line of lines) {
    const match = line.match(itemPattern)
    if (!match) continue

    const description = (match[1] ?? match[3])?.trim()
    const amount = (match[2] ?? match[4])?.trim()

    if (!description || !amount) continue
    if (/total|subtotal|tax|change|cash|paid/i.test(description)) continue
    if (description.length < 2 || description.length > 60) continue

    const numAmount = parseFloat(amount.replace(',', ''))
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > 100000) continue

    items.push({ description, amount })
  }

  return items.slice(0, 20)
}

function combineClassification(nlpResult, cvFeatures) {
  const nlpScores = {}

  for (let i = 0; i < nlpResult.labels.length; i++) {
    const label = nlpResult.labels[i]
    nlpScores[label === 'bank statement' ? 'bank_statement' : label] = nlpResult.scores[i]
  }

  const cvBoosts = {
    invoice: 0,
    receipt: 0,
    bank_statement: 0,
    other: 0
  }

  if (cvFeatures?.isLikelyDocument && cvFeatures?.isPortrait) {
    cvBoosts.invoice += 0.1
    cvBoosts.bank_statement += 0.08
  }

  if (!cvFeatures?.isLikelyDocument || cvFeatures?.aspectRatio < 0.5) {
    cvBoosts.receipt += 0.12
  }

  const blended = {
    invoice: (nlpScores.invoice ?? 0) * 0.8 + cvBoosts.invoice * 0.2,
    receipt: (nlpScores.receipt ?? 0) * 0.8 + cvBoosts.receipt * 0.2,
    bank_statement: (nlpScores.bank_statement ?? 0) * 0.8 + cvBoosts.bank_statement * 0.2,
    other: (nlpScores.other ?? 0) * 0.8
  }

  const entries = Object.entries(blended).sort((a, b) => b[1] - a[1])
  const [topLabel, topScore] = entries[0]

  const total = entries.reduce((sum, [, value]) => sum + value, 0)
  const confidence = total > 0 ? topScore / total : 0

  return {
    type: topLabel ,
    nlpLabel: topLabel,
    confidence,
    scores: blended
  }
}