import type { ExtractedFields } from '~/services/db'

export function extractFields(text: string): ExtractedFields {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const vendor = lines
    .slice(0, 5)
    .find(l => l.length > 3 && !/^\d/.test(l))

  const dateMatch =
    text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/) ||
    text.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i) ||
    text.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i) ||
    text.match(/\b(\d{4}-\d{2}-\d{2})\b/)

  const totalMatch = text.match(
    /\b(?:total|grand\s*total|amount\s*due|payable|balance\s*due)[^\d]*([\d,]+\.?\d{0,2})/i
  )

  const taxMatch = text.match(
    /\b(?:tax|gst|vat|hst|pst)[^\d]*([\d,]+\.?\d{0,2})/i
  )

  const receiptMatch = text.match(
    /\b(?:receipt|invoice|order|ref|transaction|txn|trans)\s*(?:no\.?|#|number|id)?[:\s]*([A-Z0-9\-]{3,20})/i
  )

  const paymentMatch = text.match(
    /\b(cash|visa|mastercard|amex|american\s*express|discover|debit|credit|upi|neft|rtgs|cheque|check|net\s*banking)\b/i
  )

  const items = extractLineItems(lines)

  return {
    vendor: vendor?.trim(),
    date: dateMatch?.[1]?.trim(),
    total: totalMatch?.[1]?.trim(),
    tax: taxMatch?.[1]?.trim(),
    receiptNumber: receiptMatch?.[1]?.trim(),
    paymentMethod: paymentMatch?.[1]?.trim(),
    items,
  }
}

function extractLineItems(lines: string[]) {
  const items: { description: string; amount: string }[] = []
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