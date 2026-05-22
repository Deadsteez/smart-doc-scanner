import type { ExtractedFields } from '~/services/db'

const CURRENCY_PREFIX = /(?:RM|MYR|₹|Rs\.?|INR|\$|€|£|AED|SGD|AUD|CAD)\s*/i

export function detectCurrency(text: string): string | undefined {
  if (/\bRM\b|\bMYR\b/i.test(text))    return 'MYR'
  if (/₹|\bRs\.?\b|\bINR\b/i.test(text)) return 'INR'
  if (/\$/.test(text))                    return 'USD'
  if (/€/.test(text))                     return 'EUR'
  if (/£/.test(text))                     return 'GBP'
  if (/\bAED\b/i.test(text))             return 'AED'
  if (/\bSGD\b/i.test(text))             return 'SGD'
  return undefined
}

const DATE_PATTERNS = [
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/,
  /\b(\d{4}-\d{2}-\d{2})\b/,
  /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{4})\b/i,
  /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s]+\d{1,2},?\s+\d{4})\b/i,
  /\b(\d{1,2}\s+(?:जनवरी|फ़रवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|सितम्बर|अक्टूबर|नवंबर|नवम्बर|दिसंबर|दिसम्बर|जानेवारी|फेब्रुवारी|एप्रिल|मे|जुलै|ऑगस्ट|सप्टेंबर|ऑक्टोबर|नोव्हेंबर|डिसेंबर)\s+\d{4})\b/i,
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2})\b/,
  /\b(20\d{6})\b/,
]

export function extractDate(text: string): string | undefined {
  const labelled = text.match(
    /(?:\b(?:date|dated|invoice\s*date|receipt\s*date|bill\s*date|statement\s*date)\b|दिनांक|तारीख|दि\.)\s*[:\-]?\s*([\d\/\-\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|जनवरी|फ़रवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|सितम्बर|अक्टूबर|नवंबर|नवम्बर|दिसंबर|दिसम्बर|जानेवारी|फेब्रुवारी|एप्रिल|मे|जुलै|ऑगस्ट|सप्टेंबर|ऑक्टोबर|नोव्हेंबर|डिसेंबर)?[\w\s,]*\d{2,4})/i
  )
  if (labelled && labelled[1]) {
    for (const pat of DATE_PATTERNS) {
      const m = labelled[1].match(pat)
      if (m && m[1]) return m[1]
    }
  }

  for (const pat of DATE_PATTERNS) {
    const m = text.match(pat)
    if (m) return m[1]
  }

  return undefined
}

const TOTAL_KEYWORDS =
  /(?:\b(?:grand\s*total|total\s*amount|amount\s*due|net\s*amount|amount\s*payable|payable|balance\s*due|total\s*payable|total\s*due|sub\s*total|subtotal|total)\b|कुल\s*योग|कुल\s*राशि|योग|देय\s*राशि|निवळ\s*रक्कम|एकूण\s*रक्कम|एकूण|कुल)/i

export function extractTotal(text: string, lines: string[], docType?: string): { total: string | undefined; currency: string | undefined } {
  const ccy = detectCurrency(text)

  const AD_KEYWORDS = /(?:cashback|win\s+up\s+to|scratch\s+card|pay\s+via|powered\s+by|download\s+app|ad\b|sponsor)/i
  const cleanLines = lines.filter((l, i) => {
    if (AD_KEYWORDS.test(l)) return false
    if (i > 0 && AD_KEYWORDS.test(lines[i - 1] ?? '')) return false
    return true
  })
  
  if (docType === 'utility_bill') {
    const utilityMatch = text.match(
      /(?:\b(?:bill\s*amount|payable\s*amount|net\s*bill|current\s*bill|amount\s*payable)\b)[^\d\n]{0,20}(?:RM|MYR|₹|Rs\.?|INR|\$|€|£)?\s*([\d,]+\.?\d{0,2})/i
    )
    if (utilityMatch?.[1]) return { total: utilityMatch[1], currency: ccy }
    
    for (let i = 0; i < cleanLines.length - 1; i++) {
      const currentLine = cleanLines[i]
      const nextLine = cleanLines[i + 1]
      if (currentLine && nextLine && /\b(?:bill\s*amount|payable\s*amount|net\s*bill|current\s*bill|amount\s*payable)\b/i.test(currentLine)) {
        const amtMatch = nextLine.match(/(?:RM|MYR|₹|Rs\.?|\$|€|£)?\s*([\d,]+\.?\d{0,2})/i)
        if (amtMatch?.[1]) return { total: amtMatch[1], currency: ccy }
      }
    }
  }

  const kwMatch = text.match(
    /(?:\b(?:grand\s*total|total\s*amount|amount\s*due|net\s*amount|amount\s*payable|payable|balance\s*due|total\s*payable|total\s*due|sub\s*total|subtotal|total)\b|कुल\s*योग|कुल\s*राशि|योग|देय\s*राशि|निवळ\s*रक्कम|एकूण\s*रक्कम|एकूण|कुल)[^\d\n]{0,20}(?:RM|MYR|₹|Rs\.?|INR|\$|€|£)?\s*([\d,]+\.?\d{0,2})/i
  )
  if (kwMatch?.[1]) return { total: kwMatch[1], currency: ccy }

  for (let i = 0; i < cleanLines.length - 1; i++) {
    const currentLine = cleanLines[i]
    const nextLine = cleanLines[i + 1]
    if (currentLine && nextLine && TOTAL_KEYWORDS.test(currentLine)) {
      const amtMatch = nextLine.match(
        /(?:RM|MYR|₹|Rs\.?|\$|€|£)?\s*([\d,]+\.?\d{0,2})/i
      )
      if (amtMatch?.[1]) return { total: amtMatch[1], currency: ccy }
    }
  }

  const bareTotal = text.match(/(?:\bTOTAL\b|कुल|एकूण)\s+(?:RM|MYR|₹|Rs\.?|\$|€|£)?\s*([\d,]+\.?\d{0,2})\b/i)
  if (bareTotal?.[1]) return { total: bareTotal[1], currency: ccy }

  const footerStart = Math.floor(cleanLines.length * 0.60)
  const footerText  = cleanLines.slice(footerStart).join('\n')
  const ccyAmounts  = [...footerText.matchAll(
    /(?:RM|MYR|₹|Rs\.?|INR|\$|€|£)\s*([\d,]+\.?\d{0,2})/gi
  )]

  if (ccyAmounts.length > 0) {
    const parsed = ccyAmounts
      .map(m => {
        const rawVal = m[1] || ''
        return { raw: rawVal, val: parseFloat(rawVal.replace(/[,\s]/g, '')) }
      })
      .filter(o => !isNaN(o.val) && o.val > 0)
      .sort((a, b) => b.val - a.val)

    if (parsed.length > 0 && parsed[0]) return { total: parsed[0].raw, currency: ccy }
  }

  const cleanText = cleanLines.join('\n')
  const allAmounts = [...cleanText.matchAll(/\b(\d{1,6}(?:[,\s]\d{2,3})*\.\d{2})\b/g)]
  if (allAmounts.length > 0) {
    const lastMatch = allAmounts[allAmounts.length - 1]
    if (lastMatch && lastMatch[1]) {
      const last = lastMatch[1]
      const val  = parseFloat(last.replace(/[,\s]/g, ''))
      if (val > 0 && val <= 10_000_000) return { total: last, currency: ccy }
    }
  }

  return { total: undefined, currency: ccy }
}

const ADDRESS_NOISE   = /\b(\d+\s+(jalan|lorong|persiaran|taman|street|road|ave|avenue|blvd|lane|way|dr|drive|st\.?))/i
const BUSINESS_SUFFIX = /(?:\b(?:sdn\s*bhd|bhd|pvt\.?\s*ltd|ltd|llc|inc|corp|co\.|plc|llp|gmbh)\b|लिमिटेड|लि\.?|लॉजिस्टिक|मार्ट|एंटरप्राइजेज|स्टोर्स|दुकान|व्यापारी|ब्रदर्स|प्रााइवेट|प्रा\s*लिमिटेड)/i
const CONTACT_NOISE   = /\b(tel|phone|fax|email|www\.|http)/i

export function extractVendor(lines: string[]): string | undefined {
  const candidates = lines.slice(0, 7).map((line, idx) => ({
    line,
    score: scoreVendorLine(line, idx),
  })).filter(c => c.score > 0)

  candidates.sort((a, b) => b.score - a.score)
  if (candidates.length > 0 && candidates[0]) return candidates[0].line.trim()

  return lines.slice(0, 5).find(l =>
    l.length > 3 && !/^\d/.test(l) && !ADDRESS_NOISE.test(l)
  )
}

function scoreVendorLine(line: string, idx: number): number {
  let score = Math.max(0, 4 - idx)

  if (line.length >= 4 && line.length <= 45) score += 2
  if (line.length > 45) score -= 2
  if (/^[A-Z]/.test(line)) score += 2
  if (BUSINESS_SUFFIX.test(line)) score += 5
  if (ADDRESS_NOISE.test(line)) score -= 4
  if (CONTACT_NOISE.test(line)) score -= 4
  if (/^\d+/.test(line)) score -= 5
  if (/\b(invoice|receipt|bill|statement|tax|gst)\b/i.test(line)) score -= 3

  return score
}

export function extractTax(text: string): string | undefined {
  return text.match(
    /(?:\b(?:tax|gst|vat|hst|pst|sst|service\s*tax|igst|cgst|sgst|cess)\b|कर|सेवा\s*कर|जीएसटी)[^0-9\n]{0,20}(?:RM|₹|Rs\.?|\$|€|£)?\s*([\d,]+\.?\d{0,2})/i
  )?.[1]
}

export function extractReferenceNumber(text: string): string | undefined {
  const utr = text.match(/\b(?:UTR|RRN)\s*[:\-]?\s*([0-9]{12})\b/i)?.[1]
  if (utr) return utr

  const gst = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/)?.[1]
  if (gst) return gst

  const eway = text.match(/\be[-\s]?way\s*bill\s*(?:no|number)?[:\s]*([0-9]{12})\b/i)?.[1]
  if (eway) return eway

  const generic = text.match(
    /(?:\b(?:invoice|receipt|order|ref|transaction|txn|trans|bill|doc)\b|क्रमांक|क्र\.?)\s*(?:no\.?|#|number|id)?[:\s]+([A-Z0-9\/\-]{3,25})/i
  )?.[1]
  if (generic && !/^\d{4}$/.test(generic)) return generic

  return undefined
}

export function extractPaymentMethod(text: string): string | undefined {
  return text.match(
    /(?:\b(?:cash|visa|mastercard|master\s*card|amex|american\s*express|discover|rupay|debit\s*card|credit\s*card|upi|neft|rtgs|imps|cheque|check|net\s*banking|phonepe|gpay|google\s*pay|paytm|bhim|wang\s*tunai)\b|नकद|रोख|कार्ड|चेक)/i
  )?.[1]
}

function extractLineItems(lines: string[]): { description: string; amount: string }[] {
  const items: { description: string; amount: string }[] = []
  const itemPat = /^(.+?)\s{2,}(?:RM|₹|Rs\.?|\$|€|£)?\s*([\d,]+\.?\d{0,2})\s*$|^(.+?)\s+(?:RM|₹|Rs\.?|\$|€|£)?([\d,]+\.?\d{0,2})\s*$/

  for (const line of lines) {
    const m = line.match(itemPat)
    if (!m) continue

    const description = (m[1] ?? m[3])?.trim()
    const amount      = (m[2] ?? m[4])?.trim()
    if (!description || !amount) continue

    if (/^(total|sub\s*total|subtotal|tax|gst|vat|change|amount\s*due|balance|grand\s*total)/i.test(description)) continue
    if (description.length < 2 || description.length > 70) continue

    const numAmt = parseFloat(amount.replace(/[,\s]/g, ''))
    if (isNaN(numAmt) || numAmt <= 0 || numAmt > 1_000_000) continue

    items.push({ description, amount })
    if (items.length >= 25) break
  }

  return items
}

export function extractFields(text: string, docType?: string): ExtractedFields {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const vendor         = extractVendor(lines)
  const date           = extractDate(text)
  const { total, currency } = extractTotal(text, lines, docType)
  const tax            = extractTax(text)
  const receiptNumber  = extractReferenceNumber(text)
  const paymentMethod  = extractPaymentMethod(text)
  const items          = extractLineItems(lines)

  return {
    vendor:        vendor,
    date:          date,
    total:         total,
    currency:      currency as string | undefined,
    tax:           tax,
    receiptNumber: receiptNumber,
    paymentMethod: paymentMethod,
    items,
  }
}
