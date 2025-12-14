export interface ExtractedFields {
  vendor?: string
  date?: string
  total?: string
  receiptNumber?: string
}

export function extractFields(text: string): ExtractedFields {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const vendor =
    lines.slice(0, 5).find(l => l.length > 3 && !l.match(/\d/))

  const dateMatch =
    text.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/) ||
    text.match(/\b(\d{2}\s[A-Za-z]{3,}\s\d{4})\b/)

  const totalMatch =
    text.match(/\b(Total|Amount|Payable)[^\d]*([\d.,]+)/i)

  const receiptMatch =
    text.match(/\b(Receipt|Invoice)\s*(No|#)?[:\-]?\s*(\w+)/i)

  return {
    vendor: vendor,
    date: dateMatch?.[1],
    total: totalMatch?.[2],
    receiptNumber: receiptMatch?.[3]
  }
}
