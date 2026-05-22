console.log('[NLP Worker] Starting...')

let nerPipeline = null
let classifierPipeline = null
let initPromise = null

// ─── Model init ──────────────────────────────────────────────────────────────

async function initializeWorker() {
  try {
    console.log('[NLP Worker] Importing transformers...')
    const { pipeline, env } = await import('@xenova/transformers')

    env.localModelPath  = '/models/'
    env.cacheDir        = '/models/'
    env.allowRemoteModels = true
    env.allowLocalModels  = false

    const MODEL_OPTIONS = { quantized: true }
    await loadPipelines(pipeline, MODEL_OPTIONS)
  } catch (importError) {
    console.error('[NLP Worker] Failed to import transformers:', importError)
    postMessage({ type: 'error', error: 'Failed to load NLP dependencies: ' + String(importError) })
    throw importError
  }
}

async function loadPipelines(pipeline, MODEL_OPTIONS) {
  try {
    postMessage({ type: 'progress', stage: 'ner', progress: 0.1, status: 'Loading NER model...' })

    nerPipeline = await pipeline('token-classification', 'Xenova/bert-base-NER', {
      ...MODEL_OPTIONS,
      aggregation_strategy: 'simple',
      progress_callback: (p) => {
        if (p.status === 'downloading') {
          const scaled = 0.1 + ((p.progress ?? 0) / 100) * 0.25
          postMessage({ type: 'progress', stage: 'ner', progress: parseFloat(scaled.toFixed(2)),
            status: `Downloading NER... ${p.progress?.toFixed(0) ?? ''}%` })
        } else if (p.status === 'loading') {
          postMessage({ type: 'progress', stage: 'ner', progress: 0.35, status: 'Loading NER model...' })
        }
      }
    })

    postMessage({ type: 'progress', stage: 'classifier', progress: 0.5, status: 'Loading classifier...' })

    classifierPipeline = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-small', {
      ...MODEL_OPTIONS,
      progress_callback: (p) => {
        if (p.status === 'downloading') {
          const scaled = 0.5 + ((p.progress ?? 0) / 100) * 0.35
          postMessage({ type: 'progress', stage: 'classifier', progress: parseFloat(scaled.toFixed(2)),
            status: `Downloading classifier... ${p.progress?.toFixed(0) ?? ''}%` })
        } else if (p.status === 'loading') {
          postMessage({ type: 'progress', stage: 'classifier', progress: 0.85, status: 'Loading classifier...' })
        }
      }
    })

    postMessage({ type: 'progress', stage: 'ready', progress: 1, status: 'NLP ready' })
  } catch (err) {
    console.error('[NLP Worker] Model load failed:', err)
    postMessage({ type: 'error', error: 'Failed to load NLP models: ' + String(err) })
  }
}

initPromise = initializeWorker()

// ─── Message handler ──────────────────────────────────────────────────────────

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
    postMessage({ type: 'error', error: 'Pipelines not initialized' })
    return
  }

  try {
    postMessage({ type: 'progress', stage: 'ner', progress: 0.3, status: 'Extracting entities...' })

    // Truncate to avoid OOM on very long docs; keep the most information-dense portion
    const truncated = smartTruncate(text, 2000)

    // ── 1. NER pass ──────────────────────────────────────────────────────────
    const entities = await nerPipeline(truncated)

    // ── 2. Zero-shot classification (all 8 labels) ────────────────────────
    postMessage({ type: 'progress', stage: 'classifier', progress: 0.55, status: 'Classifying document...' })

    const CLASS_LABELS = [
      'invoice',
      'receipt',
      'bank statement',
      'payment slip',
      'utility bill',
      'tax document',
      'contract',
      'other'
    ]

    const classResult = await classifierPipeline(truncated, CLASS_LABELS, { multi_label: false })

    // ── 3. Pattern-based pre-classification (fast, high-precision) ────────
    const patternCategory = patternClassify(text)

    // ── 4. Combine: pattern → NLP → CV ────────────────────────────────────
    const category = combineClassification(classResult, patternCategory, cvFeatures)

    // ── 4.5. Secondary Zero-Shot Pass for Semantic Status ─────────────────
    let semanticStatus = undefined
    if (['receipt', 'payment_slip', 'bank_statement'].includes(category.type)) {
      postMessage({ type: 'progress', stage: 'classifier', progress: 0.70, status: 'Analyzing transaction intent...' })
      const subLabels = ['payment received', 'payment sent', 'refund', 'subscription']
      const subResult = await classifierPipeline(truncated, subLabels, { multi_label: false })
      if (subResult.scores[0] > 0.40) {
        semanticStatus = subResult.labels[0]
      }
    } else if (['invoice', 'utility_bill'].includes(category.type)) {
      postMessage({ type: 'progress', stage: 'classifier', progress: 0.70, status: 'Analyzing document status...' })
      const subLabels = ['paid', 'due', 'overdue', 'pending']
      const subResult = await classifierPipeline(truncated, subLabels, { multi_label: false })
      if (subResult.scores[0] > 0.40) {
        semanticStatus = subResult.labels[0]
      }
    }

    // ── 5. Field extraction (category-aware) ──────────────────────────────
    postMessage({ type: 'progress', stage: 'ner', progress: 0.8, status: 'Extracting fields...' })
    const extracted = extractFields(text, entities, category.type)
    if (semanticStatus) {
      extracted.semanticStatus = semanticStatus
    }

    postMessage({
      type: 'result',
      extracted,
      category,
      entities: entities.map(e => ({
        word:  e.word,
        label: e.entity_group ?? e.entity,
        score: e.score
      }))
    })

  } catch (err) {
    console.error('[NLP Worker] Job error:', err)
    postMessage({ type: 'error', error: String(err) })
  }
}

// ─── Smart truncate (preserve head + tail) ────────────────────────────────────

function smartTruncate(text, maxLen) {
  if (text.length <= maxLen) return text
  // Keep first 70% from head (vendor/header/date) + 30% from tail (total/footer)
  const headLen = Math.floor(maxLen * 0.7)
  const tailLen = maxLen - headLen
  return text.slice(0, headLen) + '\n' + text.slice(-tailLen)
}

// ─── Pattern-based classifier ─────────────────────────────────────────────────
// Fast keyword scoring for all 8 categories. Used as a strong prior before NLP.

const PATTERN_RULES = {
  invoice: [
    { re: /\binvoice\b/i, w: 8 },
    { re: /\binvoice\s*(number|no\.?|#)\s*[:：]?\s*\w+/i, w: 6 },
    { re: /\b(bill\s*to|billed\s*to|ship\s*to)\b/i, w: 6 },
    { re: /\b(tax\s*invoice|gst\s*invoice|e[-\s]?invoice)\b/i, w: 7 },
    { re: /\b(gst|hsn|sac|irn)\s*(no\.?|number|#|:)/i, w: 5 },
    { re: /\b(due\s*date|payment\s*due|payment\s*terms)\b/i, w: 4 },
    { re: /\b(amount\s*due|balance\s*due|sub\s*total)\b/i, w: 4 },
    { re: /\b(purchase\s*order|po\s*(number|#|no\.?))\b/i, w: 4 },
    { re: /\bnet\s*(30|60|90|thirty|sixty|ninety)\b/i, w: 3 },
    { re: /\bprepared\s*for\b/i, w: 2 },
  ],
  receipt: [
    { re: /\breceipt\b/i, w: 8 },
    { re: /\b(paid|payment\s*received|payment\s*successful)\b/i, w: 6 },
    { re: /\b(thank\s*you\s*(for\s*(your\s*)?purchase|shopping)|have\s*a\s*(good|nice)\s*day)\b/i, w: 5 },
    { re: /\b(change\s*due|change\s*given|tender)\b/i, w: 5 },
    { re: /\b(visa|mastercard|amex|american\s*express|discover|rupay)\b/i, w: 4 },
    { re: /\b(upi|phonepe|gpay|google\s*pay|paytm|bhim)\b/i, w: 5 },
    { re: /\b(cash|card|credit|debit)\b/i, w: 3 },
    { re: /\b(utr|rrn|txn\s*(id|no))\b/i, w: 4 },
    { re: /\b(paid\s*to|sent\s*to|received\s*from)\b/i, w: 4 },
    { re: /\btransaction\s*(id|no|#)\b/i, w: 3 },
    // Malaysian receipts (SROIE dataset)
    { re: /\bRM\s*[\d,]+\.?\d{0,2}\b/, w: 4 },
    { re: /\b(terima\s*kasih|wang\s*tunai|baki)\b/i, w: 5 },
  ],
  bank_statement: [
    { re: /\baccount\s*statement\b/i, w: 9 },
    { re: /\bstatement\s*(of\s*account|period)\b/i, w: 7 },
    { re: /\b(opening|closing)\s*balance\b/i, w: 8 },
    { re: /\bavailable\s*balance\b/i, w: 6 },
    { re: /\b(withdrawal|deposit)\b/i, w: 4 },
    { re: /\baccount\s*(number|no\.?)\b/i, w: 4 },
    { re: /\b(ifsc|branch\s*code|sort\s*code|routing\s*number)\b/i, w: 6 },
    { re: /\b(neft|rtgs|imps)\b/i, w: 4 },
    { re: /\b(passbook|mini\s*statement|account\s*summary)\b/i, w: 6 },
    { re: /\bbalance\s*(brought|carried)\s*forward\b/i, w: 7 },
    { re: /\btransaction\s*(history|details|ledger)\b/i, w: 5 },
  ],
  payment_slip: [
    { re: /\bpayment\s*slip\b/i, w: 9 },
    { re: /\bchallan\b/i, w: 8 },
    { re: /\b(deposit\s*slip|pay\s*slip)\b/i, w: 8 },
    { re: /\bcheque\s*(stub|counterfoil)\b/i, w: 7 },
    { re: /\b(pay\s*order|demand\s*draft|dd)\b/i, w: 6 },
    { re: /\b(neft|rtgs|imps)\s*(confirmation|receipt|form|advice)\b/i, w: 7 },
    { re: /\bbank\s*(receipt|confirmation|advice)\b/i, w: 5 },
    { re: /\butr\s*(number|no\.?|#|:)/i, w: 6 },
    { re: /\b(tds|tcs)\s*(certificate|form|challan)\b/i, w: 5 },
    { re: /\bbank\s*reference\s*(number|no\.?)\b/i, w: 4 },
  ],
  utility_bill: [
    { re: /\b(electricity|power|light)\s*bill\b/i, w: 9 },
    { re: /\b(water|gas|lpg|telecom|telephone|mobile|broadband|internet)\s*bill\b/i, w: 9 },
    { re: /\butility\s*bill\b/i, w: 8 },
    { re: /\belectricity\s*(board|supply|authority|department)\b/i, w: 6 },
    { re: /\b(meter|consumer)\s*(number|id|no\.?)\b/i, w: 5 },
    { re: /\b(units\s*consumed|kwh|kvar)\b/i, w: 6 },
    { re: /\b(previous|current)\s*reading\b/i, w: 6 },
    { re: /\b(fixed|variable|energy|fuel)\s*charge\b/i, w: 4 },
    { re: /\b(late\s*fee|penalty|surcharge|disconnection)\b/i, w: 3 },
    { re: /\bdue\s*(date|on)\b/i, w: 2 },
    { re: /\b(billed\s*period|billing\s*period|billing\s*cycle)\b/i, w: 5 },
  ],
  tax_document: [
    { re: /\btax\s*(return|filing|document|certificate|assessment)\b/i, w: 9 },
    { re: /\bitr\b/i, w: 8 },
    { re: /\b(form\s*16|form\s*12bb|form\s*26as)\b/i, w: 8 },
    { re: /\b(assessment|demand|intimation)\s*notice\b/i, w: 8 },
    { re: /\b(tax|income)\s*(deduction|exemption|credit|refund)\b/i, w: 5 },
    { re: /\bpan\s*(number|card|no\.?)\b/i, w: 5 },
    { re: /\b(gstin|gst|vat)\s*(certificate|registration|number|no\.?)\b/i, w: 5 },
    { re: /\bfinancial\s*year\b/i, w: 4 },
    { re: /\b(fy|ay)\s*\d{2}[-–]\d{2}\b/i, w: 4 },
    { re: /\btax\s*(department|authority|office)\b/i, w: 5 },
    { re: /\b(tds\s*certificate|form\s*16a)\b/i, w: 7 },
  ],
  contract: [
    { re: /\b(agreement|contract|deed|indenture)\b/i, w: 9 },
    { re: /\bterms\s*and\s*conditions\b/i, w: 6 },
    { re: /\b(whereby|hereinafter|hereinabove|hereto|hereunder)\b/i, w: 7 },
    { re: /\b(party\s*of\s*the\s*(first|second)|party\s*a|party\s*b)\b/i, w: 6 },
    { re: /\bliability\s*(clause|section)?\b/i, w: 4 },
    { re: /\b(lease|rental|tenancy)\s*agreement\b/i, w: 8 },
    { re: /\b(employment|service|vendor|supplier)\s*agreement\b/i, w: 8 },
    { re: /\b(nda|non[-\s]?disclosure|confidentiality)\b/i, w: 8 },
    { re: /\bscope\s*of\s*work\b/i, w: 5 },
    { re: /\b(witness|notarized|notarised|attested)\b/i, w: 5 },
    { re: /\b(indemnify|indemnification|indemnity)\b/i, w: 5 },
    { re: /\b(termination|renewal|validity\s*period)\b/i, w: 3 },
    { re: /\b(force\s*majeure|governing\s*law|jurisdiction)\b/i, w: 6 },
  ],
}

function patternClassify(text) {
  const scores = {
    invoice: 0, receipt: 0, bank_statement: 0, payment_slip: 0,
    utility_bill: 0, tax_document: 0, contract: 0, other: 0
  }

  for (const [cat, rules] of Object.entries(PATTERN_RULES)) {
    for (const { re, w } of rules) {
      if (re.test(text)) scores[cat] += w
    }
  }

  const total   = Object.values(scores).reduce((a, b) => a + b, 0)
  let winner    = 'other'
  let maxScore  = 0

  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) { maxScore = score; winner = cat }
  }

  const confidence = total > 0 ? maxScore / total : 0
  // If confidence is too low or max is tiny, call it 'other'
  if (maxScore < 4 || confidence < 0.30) {
    winner = 'other'
  }

  return { type: winner, confidence, scores, total, maxScore }
}

// ─── Combined classification: pattern × NLP × CV ──────────────────────────────
// Strategy:
//   • Pattern classifier is high-precision but recall-limited.
//   • NLP zero-shot covers ambiguous / mixed-language content.
//   • CV features provide layout priors.
//   • Final score = 0.45 × pattern + 0.40 × nlp + 0.15 × cv

function combineClassification(nlpResult, patternResult, cvFeatures) {
  // NLP label → internal key (e.g. 'bank statement' → 'bank_statement')
  const labelToKey = (lbl) => lbl.replace(/\s+/g, '_')

  const NLP_WEIGHT     = 0.40
  const PATTERN_WEIGHT = 0.45
  const CV_WEIGHT      = 0.15

  // ── Normalise NLP scores to [0,1] sum ──────────────────────────────────
  const nlpRaw = {}
  for (let i = 0; i < nlpResult.labels.length; i++) {
    nlpRaw[labelToKey(nlpResult.labels[i])] = nlpResult.scores[i]
  }

  // ── Normalise pattern scores to [0,1] ─────────────────────────────────
  const patternNorm = {}
  const patTotal = patternResult.total || 1
  for (const [cat, score] of Object.entries(patternResult.scores)) {
    patternNorm[cat] = score / patTotal
  }

  // ── CV boosts (layout priors) ─────────────────────────────────────────
  const cvBoosts = {
    invoice:       0,
    receipt:       0,
    bank_statement: 0,
    payment_slip:  0,
    utility_bill:  0,
    tax_document:  0,
    contract:      0,
    other:         0,
  }

  if (cvFeatures) {
    const { isLikelyDocument, isPortrait, aspectRatio } = cvFeatures

    if (isLikelyDocument && isPortrait) {
      cvBoosts.invoice        += 0.12
      cvBoosts.bank_statement += 0.10
      cvBoosts.tax_document   += 0.08
      cvBoosts.contract       += 0.08
    }
    if (isLikelyDocument && aspectRatio >= 0.9 && aspectRatio <= 1.1) {
      // Square-ish document → likely contract / formal doc
      cvBoosts.contract    += 0.10
      cvBoosts.tax_document += 0.06
    }
    if (!isLikelyDocument || aspectRatio < 0.55) {
      // Tall narrow → receipt / payment slip
      cvBoosts.receipt      += 0.12
      cvBoosts.payment_slip += 0.08
    }
    if (isLikelyDocument && !isPortrait) {
      // Landscape → bank statement / utility bill (wide tables)
      cvBoosts.bank_statement += 0.10
      cvBoosts.utility_bill   += 0.08
    }
  }

  // Normalise CV boosts so they sum to 1 (or leave as-is if all zero)
  const cvTotal = Object.values(cvBoosts).reduce((a, b) => a + b, 0) || 1

  // ── Blend all three signals ───────────────────────────────────────────
  const ALL_CATS = ['invoice','receipt','bank_statement','payment_slip','utility_bill','tax_document','contract','other']
  const blended = {}

  for (const cat of ALL_CATS) {
    const nlpScore  = (nlpRaw[cat] ?? 0) * NLP_WEIGHT
    const patScore  = (patternNorm[cat] ?? 0) * PATTERN_WEIGHT
    const cvScore   = ((cvBoosts[cat] ?? 0) / cvTotal) * CV_WEIGHT
    blended[cat]    = nlpScore + patScore + cvScore
  }

  // ── Pick winner ────────────────────────────────────────────────────────
  const entries  = Object.entries(blended).sort((a, b) => b[1] - a[1])
  const [topKey, topScore] = entries[0]
  const blendSum = entries.reduce((s, [, v]) => s + v, 0)
  const confidence = blendSum > 0 ? topScore / blendSum : 0

  // ── Override: strong pattern signals beat everything ───────────────────
  let finalType = topKey
  if (patternResult.maxScore >= 12 && patternResult.type !== 'other') {
    // High-confidence pattern match overrides the blend
    finalType = patternResult.type
  }

  return {
    type:       finalType,
    nlpLabel:   labelToKey(nlpResult.labels[0]),
    patternType: patternResult.type,
    confidence,
    scores:     blended,
  }
}

// ─── Field extraction (category-aware, multi-currency) ───────────────────────

function extractFields(text, entities, docType) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // ── Vendor ────────────────────────────────────────────────────────────
  const vendor = extractVendor(text, lines, entities)

  // ── Date ──────────────────────────────────────────────────────────────
  const date = extractDate(text, entities)

  // ── Total / Amount ────────────────────────────────────────────────────
  const { total, currency } = extractTotal(text, lines, docType)

  // ── Tax ───────────────────────────────────────────────────────────────
  const tax = extractTax(text)

  // ── Document reference number ─────────────────────────────────────────
  const receiptNumber = extractReferenceNumber(text, docType)

  // ── Payment method ────────────────────────────────────────────────────
  const paymentMethod = extractPaymentMethod(text)

  // ── Line items ────────────────────────────────────────────────────────
  const items = extractLineItems(lines)

  // ── Extra structured fields per category ─────────────────────────────
  const extras = extractCategorySpecificFields(text, docType)

  return {
    vendor:        vendor?.trim()  || undefined,
    date:          date?.trim()    || undefined,
    total:         total?.trim()   || undefined,
    currency:      currency        || undefined,
    tax:           tax?.trim()     || undefined,
    receiptNumber: receiptNumber?.trim() || undefined,
    paymentMethod: paymentMethod?.trim() || undefined,
    items,
    ...extras,
  }
}

// ─── Vendor extraction ────────────────────────────────────────────────────────

const BUSINESS_SUFFIXES = /(?:\b(?:sdn\s*bhd|bhd|pvt\.?\s*ltd|ltd|llc|inc|corp|co\.|plc|llp|lp|gmbh|sarl)\b|लिमिटेड|लि\.?|लॉजिस्टिक|मार्ट|एंटरप्राइजेज|स्टोर्स|दुकान|व्यापारी|ब्रदर्स|प्रााइवेट|प्रा\s*लिमिटेड)/i
const ADDRESS_NOISE     = /\b(\d+\s+(jalan|lorong|persiaran|taman|street|road|ave|avenue|blvd|lane|way|dr|drive|st\.?))/i
const CITY_NOISE        = /\b(kuala\s*lumpur|petaling\s*jaya|subang|shah\s*alam|penang|johor|delhi|mumbai|bangalore|chennai|hyderabad)\b/i

function extractVendor(text, lines, entities) {
  // 1. NER — pick highest-confidence ORG entity
  const orgEntities = entities
    .filter(e => (e.entity_group ?? e.entity) === 'ORG' && e.score > 0.70)
    .sort((a, b) => b.score - a.score)

  if (orgEntities.length > 0 && orgEntities[0].score >= 0.80) {
    return cleanVendorString(orgEntities[0].word)
  }

  // 2. Header heuristic — top 6 lines, score each
  const headerLines = lines.slice(0, 6)
  const candidates  = headerLines.map((line, idx) => ({
    line,
    score: scoreVendorLine(line, idx, orgEntities)
  })).filter(c => c.score > 0)

  candidates.sort((a, b) => b.score - a.score)
  if (candidates.length > 0) {
    return cleanVendorString(candidates[0].line)
  }

  // 3. Fallback: first non-numeric, non-address line
  return lines.slice(0, 5).find(l =>
    l.length > 3 &&
    !/^\d/.test(l) &&
    !ADDRESS_NOISE.test(l)
  ) ?? undefined
}

function scoreVendorLine(line, idx, orgEntities) {
  let score = 0

  // Position: earlier lines are more likely to be the header/vendor
  score += Math.max(0, 4 - idx)

  // Length sweet spot: business names are typically 4-40 chars
  if (line.length >= 4 && line.length <= 40) score += 2
  if (line.length > 40) score -= 2

  // Starts with uppercase (business name)
  if (/^[A-Z]/.test(line)) score += 2

  // Contains a business suffix
  if (BUSINESS_SUFFIXES.test(line)) score += 5

  // NER partially matches this line
  for (const ent of orgEntities) {
    if (line.toLowerCase().includes(ent.word.toLowerCase())) score += 3
  }

  // Penalise address-like lines
  if (ADDRESS_NOISE.test(line)) score -= 4
  if (CITY_NOISE.test(line))    score -= 3
  if (/\btel|phone|fax|email|www\./i.test(line)) score -= 3
  if (/^\d+/.test(line)) score -= 5
  if (/\b(invoice|receipt|bill|statement)\b/i.test(line)) score -= 3

  return score
}

function cleanVendorString(str) {
  return str
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9\s\.\-\&\(\)]/g, '')
    .trim()
}

// ─── Date extraction ──────────────────────────────────────────────────────────

const DATE_PATTERNS = [
  // DD/MM/YYYY or DD-MM-YYYY (most common on receipts)
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/,
  // YYYY-MM-DD (ISO)
  /\b(\d{4}-\d{2}-\d{2})\b/,
  // DD Month YYYY — "22 January 2019"
  /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4})\b/i,
  // Month DD, YYYY — "January 22, 2019"
  /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s]+\d{1,2},?\s+\d{4})\b/i,
  // DD Hindi/Marathi Month YYYY
  /\b(\d{1,2}\s+(?:जनवरी|फ़रवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|सितम्बर|अक्टूबर|नवंबर|नवम्बर|दिसंबर|दिसम्बर|जानेवारी|फेब्रुवारी|एप्रिल|मे|जुलै|ऑगस्ट|सप्टेंबर|ऑक्टोबर|नोव्हेंबर|डिसेंबर)\s+\d{4})\b/i,
  // DD/MM/YY (2-digit year)
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2})\b/,
  // YYYYMMDD (compact)
  /\b(20\d{6})\b/,
]

function extractDate(text, entities) {
  // 1. NER DATE/TIME entities
  const dateEntity = entities.find(e =>
    ['DATE', 'TIME'].includes(e.entity_group ?? e.entity) && e.score > 0.60
  )
  if (dateEntity) return dateEntity.word

  // 2. Pattern scan — prefer patterns near "date" label
  const dateLabelled = text.match(
    /(?:\b(?:date|dated|invoice\s*date|receipt\s*date|bill\s*date|statement\s*date)\b|दिनांक|तारीख|दि\.)\s*[:\-]?\s*([\d\/\-\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|जनवरी|फ़रवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|सितम्बर|अक्टूबर|नवंबर|नवम्बर|दिसंबर|दिसम्बर|जानेवारी|फेब्रुवारी|एप्रिल|मे|जुलै|ऑगस्ट|सप्टेंबर|ऑक्टोबर|नोव्हेंबर|डिसेंबर)?[\w\s,]*\d{2,4})/i
  )
  if (dateLabelled) {
    for (const pat of DATE_PATTERNS) {
      const m = dateLabelled[1].match(pat)
      if (m) return m[1]
    }
  }

  // 3. Scan all date patterns
  for (const pat of DATE_PATTERNS) {
    const m = text.match(pat)
    if (m) return m[1]
  }

  return undefined
}

// ─── Total / Amount extraction (multi-currency) ───────────────────────────────

// Currency symbol patterns (incl. Malaysian RM, Indian ₹, USD, EUR, GBP)
const CURRENCY_PREFIX = /(?:RM|MYR|₹|Rs\.?|INR|\$|€|£|AED|SGD|AUD|CAD)\s*/i
const AMOUNT_CORE     = /([\d]{1,3}(?:[,\s]\d{2,3})*(?:\.\d{1,2})?)/

// "TOTAL" keywords with varying formats
const TOTAL_KEYWORDS  = /(?:\b(?:grand\s*total|total\s*amount|amount\s*due|net\s*amount|amount\s*payable|payable|balance\s*due|total\s*payable|total\s*due|sub\s*total|subtotal|total)\b|कुल\s*योग|कुल\s*राशि|योग|देय\s*राशि|निवळ\s*रक्कम|एकूण\s*रक्कम|एकूण|कुल)/i

function extractTotal(text, lines, docType) {
  let found  = undefined
  let ccy    = undefined

  // Strategy 1: Keyword + amount on same line
  const kwMatch = text.match(
    new RegExp(
      TOTAL_KEYWORDS.source +
      '[^\\d\\n]{0,20}' +
      CURRENCY_PREFIX.source +
      '?' +
      AMOUNT_CORE.source,
      'i'
    )
  )
  if (kwMatch) {
    found = kwMatch[kwMatch.length - 1]
    ccy   = detectCurrency(text)
  }

  if (!found) {
    // Strategy 2: Keyword on one line, amount on next line
    for (let i = 0; i < lines.length - 1; i++) {
      if (TOTAL_KEYWORDS.test(lines[i])) {
        const nextLine = lines[i + 1]
        const amtMatch = nextLine.match(new RegExp(CURRENCY_PREFIX.source + '?' + AMOUNT_CORE.source, 'i'))
        if (amtMatch) {
          found = amtMatch[amtMatch.length - 1]
          ccy   = detectCurrency(text)
          break
        }
      }
    }
  }

  if (!found) {
    // Strategy 3: Bare TOTAL keyword followed immediately by amount (no colon/dash)
    // e.g. "TOTAL    12.50" or "TOTAL RM12.50"
    const bareTotal = text.match(
      /(?:\bTOTAL\b|कुल|एकूण)\s+(?:RM|MYR|₹|Rs\.?|\$|€|£)?\s*([\d,]+\.?\d{0,2})\b/i
    )
    if (bareTotal) {
      found = bareTotal[1]
      ccy   = detectCurrency(text)
    }
  }

  if (!found) {
    // Strategy 4: Currency-prefixed amounts in the bottom 40% of the document
    // Find the largest plausible amount near the footer
    const footerStart   = Math.floor(lines.length * 0.60)
    const footerLines   = lines.slice(footerStart)
    const footerText    = footerLines.join('\n')
    const ccyAmounts    = [...footerText.matchAll(
      new RegExp(CURRENCY_PREFIX.source + AMOUNT_CORE.source, 'gi')
    )]

    if (ccyAmounts.length > 0) {
      // Pick the largest value (most likely the grand total)
      const parsed = ccyAmounts
        .map(m => ({ raw: m[m.length - 1], val: parseFloat((m[m.length - 1]).replace(/[,\s]/g, '')) }))
        .filter(o => !isNaN(o.val) && o.val > 0)
        .sort((a, b) => b.val - a.val)

      if (parsed.length > 0) {
        found = parsed[0].raw
        ccy   = detectCurrency(text)
      }
    }
  }

  if (!found) {
    // Strategy 5: Last standalone decimal number in document (last resort)
    const allAmounts = [...text.matchAll(/\b(\d{1,6}(?:[,\s]\d{2,3})*\.\d{2})\b/g)]
    if (allAmounts.length > 0) {
      const last = allAmounts[allAmounts.length - 1][1]
      const val  = parseFloat(last.replace(/[,\s]/g, ''))
      if (val > 0 && val <= 10_000_000) {
        found = last
        ccy   = detectCurrency(text)
      }
    }
  }

  return { total: found, currency: ccy }
}

function detectCurrency(text) {
  if (/\bRM\b|\bMYR\b/i.test(text)) return 'MYR'
  if (/₹|\bRs\.?\b|\bINR\b/i.test(text)) return 'INR'
  if (/\$/.test(text)) return 'USD'
  if (/€/.test(text)) return 'EUR'
  if (/£/.test(text)) return 'GBP'
  if (/\bAED\b/i.test(text)) return 'AED'
  if (/\bSGD\b/i.test(text)) return 'SGD'
  return undefined
}

// ─── Tax extraction ───────────────────────────────────────────────────────────

function extractTax(text) {
  return text.match(
    /(?:\b(?:tax|gst|vat|hst|pst|sst|service\s*tax|igst|cgst|sgst|cess)\b|कर|सेवा\s*कर|जीएसटी)[^0-9\n]{0,20}(?:RM|₹|Rs\.?|\$|€|£)?\s*([\d,]+\.?\d{0,2})/i
  )?.[1]
}

// ─── Reference / document number ─────────────────────────────────────────────

function extractReferenceNumber(text, docType) {
  // UTR / RRN — 12-digit bank reference
  const utr = text.match(/\b(?:UTR|RRN)\s*[:\-]?\s*([0-9]{12})\b/i)?.[1]
  if (utr) return utr

  // GST invoice number (Indian)
  const gst = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/)?.[1]
  if (gst) return gst

  // E-way bill number
  const eway = text.match(/\be[-\s]?way\s*bill\s*(?:no|number)?[:\s]*([0-9]{12})\b/i)?.[1]
  if (eway) return eway

  // Invoice/Receipt/Order number (generic)
  const generic = text.match(
    /(?:\b(?:invoice|receipt|order|ref|transaction|txn|trans|bill|document|doc)\b|क्रमांक|क्र\.?)\s*(?:no\.?|#|number|id)?[:\s]+([A-Z0-9\/\-]{3,25})/i
  )?.[1]
  if (generic && !/^\d{4}$/.test(generic)) return generic // avoid year-only matches

  // Malaysian receipt number  
  const myReceipt = text.match(/\b(?:no\.?|receipt\s*no\.?)[:\s]*([A-Z0-9\-\/]{3,20})/i)?.[1]
  if (myReceipt) return myReceipt

  return undefined
}

// ─── Payment method ───────────────────────────────────────────────────────────

function extractPaymentMethod(text) {
  return text.match(
    /(?:\b(cash|visa|mastercard|master\s*card|amex|american\s*express|discover|rupay|debit\s*card|credit\s*card|upi|neft|rtgs|imps|cheque|check|net\s*banking|phonepe|gpay|google\s*pay|paytm|bhim|wang\s*tunai)\b|नकद|रोख|कार्ड|चेक)/i
  )?.[1]
}

// ─── Line item extraction ─────────────────────────────────────────────────────

function extractLineItems(lines) {
  const items    = []
  // Pattern: description (2+ spaces or tab) amount  — OR —  description  $amount
  const itemPat  = /^(.+?)\s{2,}(?:RM|₹|Rs\.?|\$|€|£)?\s*([\d,]+\.?\d{0,2})\s*$|^(.+?)\s+(?:RM|₹|Rs\.?|\$|€|£)?([\d,]+\.?\d{0,2})\s*$/

  for (const line of lines) {
    const m = line.match(itemPat)
    if (!m) continue

    const desc   = (m[1] ?? m[3])?.trim()
    const amount = (m[2] ?? m[4])?.trim()
    if (!desc || !amount) continue

    // Filter out summary lines
    if (/^(total|sub\s*total|subtotal|tax|gst|vat|change|cash\s*tender|amount\s*due|balance|grand\s*total)/i.test(desc)) continue
    if (desc.length < 2 || desc.length > 70) continue

    const numAmt = parseFloat(amount.replace(/[,\s]/g, ''))
    if (isNaN(numAmt) || numAmt <= 0 || numAmt > 1_000_000) continue

    items.push({ description: desc, amount })
    if (items.length >= 25) break
  }

  return items
}

// ─── Category-specific extra fields ──────────────────────────────────────────

function extractCategorySpecificFields(text, docType) {
  switch (docType) {
    case 'invoice':
      return {
        invoiceNumber: text.match(/\binvoice\s*(?:no\.?|#|number|id)?[:\s]+([A-Z0-9\/\-]{2,20})/i)?.[1],
        dueDate:       extractDate(text.replace(/\bdate\b/i, ''), []), // second date = due date
        gstin:         text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/)?.[1],
        poNumber:      text.match(/\b(?:po|purchase\s*order)\s*(?:no\.?|#|number)?[:\s]+([A-Z0-9\-]{2,20})/i)?.[1],
      }

    case 'bank_statement':
      return {
        accountNumber:  text.match(/\baccount\s*(?:no\.?|number|#)[:\s]+([0-9X\-]{6,20})/i)?.[1],
        openingBalance: text.match(/\bopening\s*balance[^\d\n]{0,15}([\d,]+\.?\d{0,2})/i)?.[1],
        closingBalance: text.match(/\bclosing\s*balance[^\d\n]{0,15}([\d,]+\.?\d{0,2})/i)?.[1],
        statementPeriod: text.match(/\b(?:period|from)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i)?.[1],
        ifsc:           text.match(/\bIFSC\s*[:\-]?\s*([A-Z]{4}0[A-Z0-9]{6})\b/i)?.[1],
      }

    case 'utility_bill':
      return {
        consumerNumber: text.match(/\b(?:consumer|meter|customer)\s*(?:no\.?|number|#|id)[:\s]+([A-Z0-9\-]{3,20})/i)?.[1],
        billingPeriod:  text.match(/\b(?:billing\s*period|bill\s*period|period)[:\s]+([^\n]{3,30})/i)?.[1],
        unitsConsumed:  text.match(/\b(?:units?\s*consumed|kwh)[:\s]+([\d.]+)/i)?.[1],
      }

    case 'tax_document':
      return {
        pan:            text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/)?.[1],
        assessmentYear: text.match(/\b(?:ay|assessment\s*year)[:\s]*(20\d{2}[-–]\d{2,4})/i)?.[1],
        taxAmount:      text.match(/\b(?:tax\s*payable|demand\s*raised|tax\s*liability)[^\d\n]{0,15}([\d,]+\.?\d{0,2})/i)?.[1],
      }

    case 'payment_slip':
      return {
        utrNumber:    text.match(/\bUTR\s*[:\-]?\s*([0-9]{12,22})\b/i)?.[1],
        bankReference: text.match(/\b(?:bank\s*ref|reference|ref\s*no)[:\s]+([A-Z0-9\-]{4,25})/i)?.[1],
        transferMode: text.match(/\b(NEFT|RTGS|IMPS|UPI|CHEQUE|DD)\b/i)?.[1],
      }

    default:
      return {}
  }
}

// ─── Fallback helpers (kept for backward compat) ─────────────────────────────

function fallbackVendor(lines) {
  return lines.slice(0, 5).find(l => l.length > 3 && !/^\d/.test(l))
}