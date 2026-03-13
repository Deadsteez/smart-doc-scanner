
// In Nuxt, `~` maps to the project root. `@` is not configured by default
// and will cause a module-not-found error at build time.
import type { CvFeatures } from '~/composables/useCvFeatures'

export type DocumentType = 'invoice' | 'receipt' | 'other'

export interface ClassificationResult {
  type: DocumentType
  confidence: number
  scores: {
    invoice: number
    receipt: number
  }
}

const MIN_TOTAL_SCORE = 5
const MIN_CONFIDENCE = 0.6
const MIN_WINNING_SCORE = 4

export function classifyDocument(text: string, cv: CvFeatures): ClassificationResult {
  if (!text || !text.trim()) {
    return { type: 'other', confidence: 0, scores: { invoice: 0, receipt: 0 } }
  }

  const scores = { invoice: 0, receipt: 0 }

  const invoicePatterns = [
    { pattern: /\binvoice\b/i, score: 5 },
    { pattern: /\binvoice\s*(number|#|no\.?)\s*:?\s*\w+/i, score: 4 },
    { pattern: /\b(bill\s*to|billed\s*to)\b/i, score: 4 },
    { pattern: /\b(due\s*date|payment\s*due)\b/i, score: 3 },
    { pattern: /\b(terms|payment\s*terms)\b/i, score: 3 },
    { pattern: /\bvalid\s*for\b/i, score: 2 },
    { pattern: /\bprepared\s*for\b/i, score: 2 },
    { pattern: /\bsub\s*total\b/i, score: 2 },
    { pattern: /\bamount\s*due\b/i, score: 3 },
    { pattern: /\b(purchase\s*order|po\s*(number|#|no\.?))\b/i, score: 2 },
    { pattern: /\bnet\s*(\d+|thirty|sixty|ninety)\b/i, score: 2 },
    { pattern: /\bquote\b/i, score: 1 }
  ]

  const receiptPatterns = [
    { pattern: /\breceipt\b/i, score: 5 },
    { pattern: /\b(paid|payment\s*received)\b/i, score: 4 },
    { pattern: /\btotal\s*:?\s*\$?\d+/i, score: 3 },
    { pattern: /\b(cash|card|credit|debit)\b/i, score: 3 },
    { pattern: /\b(change|change\s*due)\s*:?\s*\$?\d+/i, score: 2 },
    { pattern: /\b(transaction|trans\s*(#|no\.?|id))\b/i, score: 2 },
    { pattern: /\bthank\s*you\b/i, score: 2 },
    { pattern: /\b(visa|mastercard|amex|discover)\b/i, score: 2 },
    { pattern: /\btender\b/i, score: 2 },
    { pattern: /\bref\s*(#|no\.?)\s*:?\s*\w+/i, score: 1 }
  ]

  for (const { pattern, score } of invoicePatterns) {
    if (pattern.test(text)) scores.invoice += score
  }
  for (const { pattern, score } of receiptPatterns) {
    if (pattern.test(text)) scores.receipt += score
  }

  if (cv.isLikelyDocument && cv.isPortrait) scores.invoice += 2
  if (!cv.isLikelyDocument) scores.receipt += 2
  if (cv.aspectRatio < 0.5) scores.receipt += 2

  const total = scores.invoice + scores.receipt
  const maxScore = Math.max(scores.invoice, scores.receipt)
  const confidence = total > 0 ? maxScore / total : 0

  if (total < MIN_TOTAL_SCORE || maxScore < MIN_WINNING_SCORE || confidence < MIN_CONFIDENCE) {
    return { type: 'other', confidence, scores }
  }

  return scores.invoice >= scores.receipt
    ? { type: 'invoice', confidence, scores }
    : { type: 'receipt', confidence, scores }
}