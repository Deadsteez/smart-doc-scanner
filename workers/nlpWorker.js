
// Load in CameraCapture.vue as:
// import NlpWorker from '~/workers/nlpWorker.js?worker'

import { pipeline, env } from '@xenova/transformers'

console.log('[NLP Worker] Starting...')

// Model config
env.localModelPath = '/models/'
env.cacheDir = '/models/'
env.allowRemoteModels = true  // fallback to CDN if local missing
env.allowLocalModels = true


console.log('[NLP Worker] Model path:', env.localModelPath)

const MODEL_OPTIONS = { quantized: true }

let nerPipeline = null
let classifierPipeline = null

// Load models immediately on worker start 
// Don't wait for first message — start loading now so
// models are ready (or nearly ready) when OCR finishes.
const initPromise = loadPipelines()

async function loadPipelines() {
  try {
    postMessage({ type: 'progress', stage: 'ner', progress: 0.1, status: 'Loading NER model...' })
    console.log('[NLP Worker] Loading NER pipeline...')

  nerPipeline = await pipeline(
  'token-classification',
  'Xenova/bert-base-NER',
  {
    ...MODEL_OPTIONS,
    aggregation_strategy: 'simple',
        progress_callback: (p) => {
          console.log('[NLP Worker] NER:', p.status, p.file ?? '', p.progress != null ? p.progress.toFixed(0) + '%' : '')
          if (p.status === 'downloading') {
            postMessage({ type: 'progress', stage: 'ner', progress: 0.2, status: `Downloading NER... ${p.progress?.toFixed(0) ?? ''}%` })
          } else if (p.status === 'loading') {
            postMessage({ type: 'progress', stage: 'ner', progress: 0.35, status: 'Loading NER model...' })
          }
        }
      }
    )
    console.log('[NLP Worker] NER ready ')

    postMessage({ type: 'progress', stage: 'classifier', progress: 0.5, status: 'Loading classifier...' })
    console.log('[NLP Worker] Loading classifier pipeline...')


   classifierPipeline = await pipeline(
  'zero-shot-classification',
  'Xenova/nli-deberta-v3-small',
      {
        ...MODEL_OPTIONS,
        progress_callback: (p) => {
          console.log('[NLP Worker] Classifier:', p.status, p.file ?? '', p.progress != null ? p.progress.toFixed(0) + '%' : '')
          if (p.status === 'downloading') {
            postMessage({ type: 'progress', stage: 'classifier', progress: 0.7, status: `Downloading classifier... ${p.progress?.toFixed(0) ?? ''}%` })
          } else if (p.status === 'loading') {
            postMessage({ type: 'progress', stage: 'classifier', progress: 0.85, status: 'Loading classifier...' })
          }
        }
      }
    )
    console.log('[NLP Worker] Classifier ready ')

    // Signal CameraCapture — queue will now drain
    postMessage({ type: 'progress', stage: 'ready', progress: 1.0, status: 'NLP ready' })
    console.log('[NLP Worker] All models loaded ')

  } catch (err) {
    console.error('[NLP Worker] Model load failed:', err)
    postMessage({ type: 'error', error: 'Failed to load NLP models: ' + String(err) })
  }
}

//Message handler
self.onmessage = async (e) => {
  const { text, cvFeatures,image } = e.data
  if (!text?.trim()) {
    postMessage({ type: 'error', error: 'No text provided' })
    return
  }

  console.log('[NLP Worker] Job received, text length:', text.length)

  try {
    // Wait for models if still loading
    await initPromise

    if (!nerPipeline || !classifierPipeline) {
      throw new Error('Pipelines not initialized after init')
    }

    postMessage({ type: 'progress', stage: 'ner', progress: 0.3, status: 'Extracting fields...' })

    const truncated = text.slice(0, 2000)
    const entities = await nerPipeline(truncated)
    console.log('[NLP Worker] Entities found:', entities.length)

    const extracted = extractFields(text, entities)

    postMessage({ type: 'progress', stage: 'classifier', progress: 0.7, status: 'Classifying document...' })

    const classLabels = ['invoice','receipt', 'bank statement','payment slip','utility bill','tax document',
  'contract','other']

    const classResult = await classifierPipeline(truncated, classLabels)
    const category = combineClassification(classResult, cvFeatures)

    console.log('[NLP Worker] Done. Category:', category.type, 'Confidence:', category.confidence.toFixed(2))

    postMessage({
      type: 'result',
      extracted,
      category,
      entities: entities.map(e => ({
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
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const orgEntities = entities
    .filter(e => (e.entity_group ?? e.entity) === 'ORG' && e.score > 0.7)
    .sort((a, b) => b.score - a.score)

  const vendor = orgEntities[0]?.word
    ?? lines.slice(0, 5).find(l => l.length > 3 && !/^\d/.test(l))

  const dateEntity = entities.find(e =>
    ['DATE', 'TIME'].includes(e.entity_group ?? e.entity) && e.score > 0.6
  )
  const dateRegex =
    text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/) ||
    text.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i) ||
    text.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i)
  const date = dateEntity?.word ?? dateRegex?.[1]

  const moneyEntities = entities
    .filter(e => (e.entity_group ?? e.entity) === 'MONEY' && e.score > 0.6)
    .map(e => ({ word: e.word, num: parseFloat(e.word.replace(/[^0-9.]/g, '')) }))
    .filter(e => !isNaN(e.num))
    .sort((a, b) => b.num - a.num)

  const totalRegex = text.match(
    /\b(?:total|grand\s*total|amount\s*due|payable|balance\s*due)[^\d]*?([\d,]+\.?\d{0,2})/i
  )
  const total = moneyEntities[0]?.word ?? totalRegex?.[1]

  const taxRegex = text.match(/\b(?:tax|gst|vat|hst|pst)[^\d]*?([\d,]+\.?\d{0,2})/i)
  const tax = taxRegex?.[1]

  const receiptRegex = text.match(
    /\b(?:receipt|invoice|order|ref|transaction|txn|trans)\s*(?:no\.?|#|number|id)?[:\s]*([A-Z0-9\-]{3,20})/i
  )
  const receiptNumber = receiptRegex?.[1]

  const paymentRegex = text.match(
    /\b(cash|visa|mastercard|amex|american\s*express|discover|debit|credit|upi|neft|rtgs|cheque|check|net\s*banking)\b/i
  )
  const paymentMethod = paymentRegex?.[1]

  const items = extractLineItems(lines)

  return {
    vendor: vendor?.trim(),
    date: date?.trim(),
    total: total?.trim(),
    tax: tax?.trim(),
    receiptNumber: receiptNumber?.trim(),
    paymentMethod: paymentMethod?.trim(),
    items
  }
}


// Fallback extraction functions
function fallbackVendor(lines) {
  return lines.slice(0, 5).find(l => l.length > 3 && !/^\d/.test(l))
}

function fallbackDate(text) {
  const dateMatch =
    text.match(/\b(\d{1,2}[\\/\-]\d{1,2}[\\/\-]\d{2,4})\b/) ||
    text.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i) ||
    text.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i)
  return dateMatch?.[1]
}

function fallbackTotal(text) {
  const totalMatch = text.match(
    /\b(?:total|grand\s*total|amount\s*due|payable|balance\s*due)[^\d]*?([\d,]+\.?\d{0,2})/i
  )
  return totalMatch?.[1]
}

function fallbackTax(text) {
  const taxMatch = text.match(/\b(?:tax|gst|vat|hst|pst)[^\d]*?([\d,]+\.?\d{0,2})/i)
  return taxMatch?.[1]
}

function fallbackReceiptNumber(text) {
  const receiptMatch = text.match(
    /\b(?:receipt|invoice|order|ref|transaction|txn|trans)\s*(?:no\.?|#|number|id)?[:\s]*([A-Z0-9\-]{3,20})/i
  )
  return receiptMatch?.[1]
}

function fallbackPaymentMethod(text) {
  const paymentMatch = text.match(
    /\b(cash|visa|mastercard|amex|american\s*express|discover|debit|credit|upi|neft|rtgs|cheque|check|net\s*banking)\b/i
  )
  return paymentMatch?.[1]
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

  const cvBoosts = { invoice: 0, receipt: 0, bank_statement: 0, other: 0 }
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
    other: (nlpScores.other ?? 0) * 0.8 + cvBoosts.other * 0.2,
  }

  const entries = Object.entries(blended).sort((a, b) => b[1] - a[1])
  const [topLabel, topScore] = entries[0]
  const total = entries.reduce((s, [, v]) => s + v, 0)
  const confidence = total > 0 ? topScore / total : 0
  const typeMap = { invoice: 'invoice', receipt: 'receipt', bank_statement: 'other', other: 'other' }

  return {
    type: typeMap[topLabel] ?? 'other',
    nlpLabel: topLabel,
    confidence,
    scores: {
      invoice: blended.invoice,
      receipt: blended.receipt,
      bank_statement: blended.bank_statement,
      other: blended.other
    }
  }
}