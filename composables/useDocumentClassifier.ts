type CvFeatures = {
  aspectRatio: number
  isPortrait: boolean
  isLikelyDocument: boolean
}

export function classifyDocument(
  text: string,
  cv: CvFeatures
): 'invoice' | 'receipt' | 'other' {

  const t = text.toLowerCase()

  let score = {
    invoice: 0,
    receipt: 0
  }

  // --------------------
  // NLP signals
  // --------------------
  if (t.includes('invoice')) score.invoice += 5
  if (t.includes('invoice number')) score.invoice += 4
  if (t.includes('terms')) score.invoice += 3
  if (t.includes('valid for')) score.invoice += 3
  if (t.includes('prepared for')) score.invoice += 2

  if (t.includes('receipt')) score.receipt += 5
  if (t.includes('paid')) score.receipt += 4
  if (t.includes('payment received')) score.receipt += 4

  // --------------------
  // CV signals
  // --------------------
  if (cv.isLikelyDocument) score.invoice += 2
  if (!cv.isLikelyDocument) score.receipt += 2
  if (!cv.isPortrait) score.invoice += 1

  // --------------------
  // Decision
  // --------------------
  if (score.invoice >= score.receipt && score.invoice > 0) {
    return 'invoice'
  }

  if (score.receipt > 0) {
    return 'receipt'
  }

  return 'other'
}
