import type { CvFeatures } from '~/composables/useCvFeatures'

export type DocumentType = 
  | 'invoice' 
  | 'receipt' 
  | 'bank_statement' 
  | 'payment_slip' 
  | 'utility_bill' 
  | 'tax_document' 
  | 'contract' 
  | 'other'

export interface ClassificationResult {
  type: DocumentType
  confidence: number
  scores: {
    invoice: number
    receipt: number
    bank_statement: number
    payment_slip: number
    utility_bill: number
    tax_document: number
    contract: number
    other: number
  }
}


const invoicePatterns = [
  { pattern: /\binvoice\b/i,                                          score: 5 },
  { pattern: /\binvoice\s*(number|#|no\.?)\s*:?\s*\w+/i,             score: 4 },
  { pattern: /\b(bill\s*to|billed\s*to)\b/i,                         score: 4 },
  { pattern: /\b(due\s*date|payment\s*due)\b/i,                       score: 3 },
  { pattern: /\b(terms|payment\s*terms)\b/i,                          score: 3 },
  { pattern: /\bvalid\s*for\b/i,                                      score: 2 },
  { pattern: /\bprepared\s*for\b/i,                                   score: 2 },
  { pattern: /\bsub\s*total\b/i,                                      score: 2 },
  { pattern: /\bamount\s*due\b/i,                                      score: 3 },
  { pattern: /\b(purchase\s*order|po\s*(number|#|no\.?))\b/i,         score: 2 },
  { pattern: /\bnet\s*(\d+|thirty|sixty|ninety)\b/i,                  score: 2 },
  { pattern: /\bquote\b/i,                                             score: 1 },
  { pattern: /\b(tax\s*invoice|gst\s*invoice)\b/i,                    score: 4 },
  { pattern: /\b(gst|hsn|sac)\s*(no\.?|number|#|:)/i,                score: 3 },
  { pattern: /\bship\s*to\b/i,                                         score: 2 },
  { pattern: /\b(e[-\s]?invoice|irn)\b/i,                             score: 3 },
]

const receiptPatterns = [
  { pattern: /\breceipt\b/i,                                           score: 5 },
  { pattern: /\b(paid|payment\s*received)\b/i,                         score: 4 },
  { pattern: /\btotal\s*:?\s*[$₹]?\d+/i,                             score: 3 },
  { pattern: /\b(cash|card|credit|debit)\b/i,                          score: 3 },
  { pattern: /\b(change|change\s*due)\s*:?\s*[$₹]?\d+/i,             score: 2 },
  { pattern: /\b(transaction|trans\s*(#|no\.?|id))\b/i,               score: 2 },
  { pattern: /\bthank\s*you\b/i,                                        score: 2 },
  { pattern: /\b(visa|mastercard|amex|discover)\b/i,                   score: 2 },
  { pattern: /\btender\b/i,                                             score: 2 },
  { pattern: /\bref\s*(#|no\.?)\s*:?\s*\w+/i,                         score: 1 },
  { pattern: /\bupi\b/i,                                               score: 3 },
  { pattern: /\b(phonepe|gpay|google\s*pay|paytm)\b/i,                score: 3 },
  { pattern: /\b(paid\s*to|sent\s*to|received\s*from)\b/i,            score: 3 },
  { pattern: /\b(utr|rrn)\b/i,                                         score: 2 },
]

const bankStatementPatterns = [
  { pattern: /\baccount\s*statement\b/i,                               score: 6 },
  { pattern: /\bstatement\s*(of\s*account|period)\b/i,                score: 5 },
  { pattern: /\b(opening|closing)\s*balance\b/i,                      score: 5 },
  { pattern: /\bavailable\s*balance\b/i,                               score: 4 },
  { pattern: /\b(withdrawal|deposit)\b/i,                              score: 3 },
  { pattern: /\b(debit|credit)\b/i,                                    score: 2 },
  { pattern: /\baccount\s*(number|no\.?)\b/i,                          score: 3 },
  { pattern: /\bbranch\b/i,                                             score: 2 },
  { pattern: /\bifsc\b/i,                                               score: 4 },
  { pattern: /\b(neft|rtgs|imps)\b/i,                                  score: 3 },
  { pattern: /\bpassbook\b/i,                                           score: 4 },
  { pattern: /\btransaction\s*(history|details)\b/i,                   score: 3 },
  { pattern: /\bbalance\s*(brought|carried)\s*forward\b/i,             score: 5 },
  { pattern: /\b(mini\s*statement|account\s*summary)\b/i,              score: 4 },
]

const paymentSlipPatterns = [
  { pattern: /\bpayment\s*slip\b/i,                                     score: 6 },
  { pattern: /\bchallan\b/i,                                            score: 5 },
  { pattern: /\bdeposit\s*slip\b/i,                                     score: 5 },
  { pattern: /\bcheque\s*stub\b/i,                                      score: 5 },
  { pattern: /\bpay\s*order\b/i,                                        score: 4 },
  { pattern: /\bdemand\s*draft\b/i,                                     score: 4 },
  { pattern: /\b(neft|rtgs|imps)\s*(confirmation|receipt|form)\b/i,    score: 4 },
  { pattern: /\bbank\s*(receipt|confirmation)\b/i,                     score: 3 },
  { pattern: /\butr\b/i,                                                score: 3 },
  { pattern: /\b(tds|tcs)\s*(certificate|form)\b/i,                    score: 2 },
  { pattern: /\bbank\s*reference\b/i,                                   score: 2 },
  { pattern: /\b(paid\s*through|crossed\s*account)\b/i,               score: 2 },
]

const utilityBillPatterns = [
  { pattern: /\b(electricity|power|light)\s*bill\b/i,                  score: 6 },
  { pattern: /\b(water|gas|telecom|telephone|mobile)\s*bill\b/i,       score: 6 },
  { pattern: /\butility\s*bill\b/i,                                     score: 5 },
  { pattern: /\belectricity\s*(board|supply|authority)\b/i,            score: 4 },
  { pattern: /\b(msedcl|mahavitaran|bescom|mgl|iggl)\b/i,               score: 6 },
  { pattern: /\bmaharashtra\s*state\s*electricity\b/i,                 score: 6 },
  { pattern: /\b(meter|consumer)\s*(number|id|no\.?)\b/i,              score: 3 },
  { pattern: /\b(units|units\s*consumed|kWh)\b/i,                      score: 3 },
  { pattern: /\b(due\s*date|payment\s*due\s*on)\b/i,                   score: 2 },
  { pattern: /\b(previous|current)\s*reading\b/i,                      score: 3 },
  { pattern: /\b(bill\s*amount|payable\s*amount|net\s*bill)\b/i,       score: 3 },
  { pattern: /\btotal\s*amount\s*payable\b/i,                           score: 4 },
  { pattern: /\brecurring\s*deposit|monthly\s*(charge|fee)\b/i,        score: 2 },
  { pattern: /\b(fixed|variable)\s*charge\b/i,                         score: 2 },
  { pattern: /\b(late\s*fee|penalty|surcharge)\b/i,                    score: 2 },
]

const taxDocumentPatterns = [
  { pattern: /\btax\s*(return|filing|document|certificate)\b/i,        score: 6 },
  { pattern: /\bitr\b/i,                                                score: 5 },
  { pattern: /\b(form\s*16|form\s*12bb)\b/i,                           score: 5 },
  { pattern: /\bform\s*\d+[a-z]?\b/i,                                  score: 3 },
  { pattern: /\b(assessment|demand)\s*notice\b/i,                      score: 5 },
  { pattern: /\b(tax|income)\s*(deduction|exemption)\b/i,              score: 3 },
  { pattern: /\bpan\s*(number|card)\b/i,                               score: 3 },
  { pattern: /\b(gstin|gst|vat)\s*(certificate|registration)\b/i,      score: 4 },
  { pattern: /\bfinancial\s*year\b/i,                                   score: 2 },
  { pattern: /\b(fy|aq)\s*\d{2}-\d{2}\b/i,                             score: 2 },
  { pattern: /\btax\s*department\b/i,                                   score: 3 },
  { pattern: /\b(refund|rebate|relief)\b/i,                             score: 2 },
]

const contractPatterns = [
  { pattern: /\b(agreement|contract|deed|indenture)\b/i,               score: 6 },
  { pattern: /\bterms\s*and\s*conditions\b/i,                          score: 4 },
  { pattern: /\b(whereby|hereinafter|party)\b/i,                       score: 4 },
  { pattern: /\bliability\b/i,                                          score: 2 },
  { pattern: /\b(lease|rental)\s*agreement\b/i,                        score: 5 },
  { pattern: /\b(employment|service)\s*agreement\b/i,                  score: 5 },
  { pattern: /\b(nda|non[\s-]?disclosure)\b/i,                         score: 5 },
  { pattern: /\bscope\s*of\s*work\b/i,                                  score: 3 },
  { pattern: /\b(signature|signed|dated)\b/i,                          score: 2 },
  { pattern: /\b(witness|notarized)\b/i,                               score: 3 },
  { pattern: /\b(indemnify|indemnification)\b/i,                       score: 3 },
  { pattern: /\b(termination|renewal|validity)\b/i,                    score: 2 },
]

function computeScores(text: string): { 
  invoice: number
  receipt: number
  bank_statement: number
  payment_slip: number
  utility_bill: number
  tax_document: number
  contract: number
  other: number
} {
  const scores = { 
    invoice: 0, 
    receipt: 0, 
    bank_statement: 0,
    payment_slip: 0,
    utility_bill: 0,
    tax_document: 0,
    contract: 0,
    other: 0
  }

  for (const { pattern, score } of invoicePatterns) {
    if (pattern.test(text)) scores.invoice += score
  }
  for (const { pattern, score } of receiptPatterns) {
    if (pattern.test(text)) scores.receipt += score
  }
  for (const { pattern, score } of bankStatementPatterns) {
    if (pattern.test(text)) scores.bank_statement += score
  }
  for (const { pattern, score } of paymentSlipPatterns) {
    if (pattern.test(text)) scores.payment_slip += score
  }
  for (const { pattern, score } of utilityBillPatterns) {
    if (pattern.test(text)) scores.utility_bill += score
  }
  for (const { pattern, score } of taxDocumentPatterns) {
    if (pattern.test(text)) scores.tax_document += score
  }
  for (const { pattern, score } of contractPatterns) {
    if (pattern.test(text)) scores.contract += score
  }

  return scores
}


function applyVisualHints(
  scores: { 
    invoice: number
    receipt: number
    bank_statement: number
    payment_slip: number
    utility_bill: number
    tax_document: number
    contract: number
    other: number
  },
  cv: CvFeatures
) {
  
  if (cv.isLikelyDocument && cv.isPortrait) {
    scores.invoice        += 2
    scores.bank_statement += 2
    scores.tax_document   += 1
    scores.contract       += 1
  }

  
  if (cv.aspectRatio < 0.5) {
    scores.bank_statement += 3
    scores.payment_slip   += 2
    scores.receipt        += 1
  }

  
  if (!cv.isLikelyDocument) {
    scores.receipt     += 2
    scores.utility_bill += 1
  }

  
  if (cv.isLikelyDocument && cv.aspectRatio >= 0.9 && cv.aspectRatio <= 1.1) {
    scores.contract    += 2
    scores.tax_document += 1
  }
}


function applyOverrides(
  winnerType: DocumentType,
  winnerScore: number,
  scores: ReturnType<typeof computeScores>,
  text: string
): DocumentType {
  
  if (
    winnerType === 'receipt' &&
    /account\s*statement|opening\s*balance|closing\s*balance/i.test(text) &&
    scores.bank_statement >= 5
  ) {
    return 'bank_statement'
  }

  
  if (
    winnerType === 'receipt' &&
    /\btax\s*invoice\b|\binvoice\s*(no|number|#)\b/i.test(text) &&
    scores.invoice >= 5
  ) {
    return 'invoice'
  }

  
  if (
    (winnerType === 'invoice' || winnerType === 'receipt' || winnerType === 'other') &&
    /(itr|form\s*16|assessment\s*notice|tax\s*certificate)/i.test(text) &&
    scores.tax_document >= 4
  ) {
    return 'tax_document'
  }

 
  if (
    (winnerType === 'invoice' || winnerType === 'other') &&
    /(agreement|lease\s*agreement|nda|non[\s-]?disclosure)/i.test(text) &&
    scores.contract >= 5
  ) {
    return 'contract'
  }

  
  if (
    (winnerType === 'receipt' || winnerType === 'other' || winnerType === 'invoice') &&
    /(electricity|power|water|gas|telecom)\s*bill|meter\s*number|msedcl|mahavitaran/i.test(text) &&
    scores.utility_bill >= 4
  ) {
    return 'utility_bill'
  }

  if (
    winnerType === 'bank_statement' &&
    /(payment\s*slip|challan|deposit\s*slip|cheque\s*stub|neft\s*confirmation)/i.test(text) &&
    scores.payment_slip >= 4
  ) {
    return 'payment_slip'
  }

  return winnerType
}


export function classifyDocument(text: string, cv: CvFeatures): ClassificationResult {
  if (!text?.trim()) {
    return { 
      type: 'other', 
      confidence: 0, 
      scores: { 
        invoice: 0, 
        receipt: 0, 
        bank_statement: 0,
        payment_slip: 0,
        utility_bill: 0,
        tax_document: 0,
        contract: 0,
        other: 0
      } 
    }
  }

  const scores = computeScores(text)
  applyVisualHints(scores, cv)


  const total = Object.values(scores).reduce((a, b) => a + b, 0)
 
  let maxScore = 0
  let winner: DocumentType = 'other'
  
  for (const [category, score] of Object.entries(scores) as Array<[DocumentType, number]>) {
    if (score > maxScore) {
      maxScore = score
      winner = category
    }
  }

  const confidence = total > 0 ? maxScore / total : 0

  if (total < 5 || maxScore < 4 || confidence < 0.50) {
    return { type: 'other', confidence, scores }
  }

  winner = applyOverrides(winner, maxScore, scores, text)

  return { type: winner, confidence, scores }
}

export function useDocumentClassifier() {
  return { classifyDocument }
}

export function getCategoryLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    invoice: 'Invoice',
    receipt: 'Receipt',
    bank_statement: 'Bank Statement',
    payment_slip: 'Payment Slip',
    utility_bill: 'Utility Bill',
    tax_document: 'Tax Document',
    contract: 'Contract',
    other: 'Other',
  }
  return labels[type] || 'Other'
}

export function getCategoryDescription(type: DocumentType): string {
  const descriptions: Record<DocumentType, string> = {
    invoice: 'Commercial invoice or billing document',
    receipt: 'Payment receipt or transaction proof',
    bank_statement: 'Bank account statement or passbook',
    payment_slip: 'Payment confirmation or bank slip',
    utility_bill: 'Electricity, water, gas, or telecom bill',
    tax_document: 'Tax return, certificate, or notice',
    contract: 'Agreement, lease, NDA, or formal contract',
    other: 'Unclassified document',
  }
  return descriptions[type] || 'Unknown document type'
}