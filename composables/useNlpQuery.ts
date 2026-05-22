// ─── Natural Language Query Parser ───────────────────────────────────────────
//
// Converts free-form user queries into structured filter objects.
// Example:
//   "petrol expenses last month above 500"
//   → { expenseCategory: 'fuel', dateRange: 'last_month', minAmount: 500 }
//
// This is SEMANTIC AI: the system understands USER INTENT, not just keywords.
//

import type { ExpenseCategory } from '~/services/vendorIntelligence'

export interface ParsedQuery {
  raw:             string
  semanticQuery:   string                  // cleaned text to embed
  category?:       string                  // document type filter
  expenseCategory?: ExpenseCategory        // expense category filter
  minAmount?:      number
  maxAmount?:      number
  vendor?:         string
  dateFrom?:       string                  // ISO date
  dateTo?:         string                  // ISO date
  semanticTags?:   string[]
  intent?:         'search' | 'summary' | 'find_duplicates' | 'analytics'
}

// ─── Intent detection ─────────────────────────────────────────────────────────

const INTENT_PATTERNS: [RegExp, ParsedQuery['intent']][] = [
  [/\b(total|sum|how much|spent|expenditure|analytics|breakdown|report)\b/i, 'summary'],
  [/\b(duplicate|same|similar|copy|uploaded\s*before)\b/i, 'find_duplicates'],
  [/\b(chart|graph|trend|monthly|weekly|analysis)\b/i, 'analytics'],
]

// ─── Expense category NL patterns ────────────────────────────────────────────

const EXPENSE_CATEGORY_NL: [RegExp, ExpenseCategory][] = [
  [/\b(food|eating|restaurant|dining|meal|lunch|dinner|breakfast|snack|coffee|swiggy|zomato)\b/i, 'food'],
  [/\b(petrol|diesel|fuel|petroleum|cng|indian\s*oil|hp|bpcl|hpcl|filling)\b/i, 'fuel'],
  [/\b(travel|transport|bus|train|metro|cab|ola|uber|flight|ticket|irctc|booking)\b/i, 'transport'],
  [/\b(electricity|water|gas|internet|wifi|broadband|phone|mobile|telecom|utility|bill)\b/i, 'utilities'],
  [/\b(shopping|purchase|order|amazon|flipkart|bought|buy|myntra)\b/i, 'shopping'],
  [/\b(medical|health|doctor|hospital|pharmacy|medicine|treatment|clinic)\b/i, 'medical'],
  [/\b(office|business|stationery|courier|work\s*expense)\b/i, 'office'],
  [/\b(movie|cinema|netflix|spotify|hotstar|entertainment|game|play)\b/i, 'entertainment'],
  [/\b(bank|insurance|lic|investment|mutual\s*fund|loan|emi|financial)\b/i, 'financial'],
  [/\b(school|college|course|tuition|education|fee|training|learning)\b/i, 'education'],
]

// ─── Document category NL patterns ───────────────────────────────────────────

const DOC_CATEGORY_NL: [RegExp, string][] = [
  [/\b(invoice|invoices|billing)\b/i, 'invoice'],
  [/\b(receipt|receipts)\b/i, 'receipt'],
  [/\b(bank\s*statement|statement|account\s*statement)\b/i, 'bank_statement'],
  [/\b(payment\s*slip|challan|pay\s*slip|bank\s*slip)\b/i, 'payment_slip'],
  [/\b(utility\s*bill|electric\s*bill|water\s*bill|gas\s*bill)\b/i, 'utility_bill'],
  [/\b(tax|itr|gst\s*(return|certificate))\b/i, 'tax_document'],
  [/\b(contract|agreement|nda|deed)\b/i, 'contract'],
]

// ─── Date range NL patterns ───────────────────────────────────────────────────

function parseDateRange(query: string): { dateFrom?: string; dateTo?: string } {
  const now    = new Date()
  const today  = now.toISOString().slice(0, 10)

  // "today"
  if (/\btoday\b/i.test(query)) {
    return { dateFrom: today, dateTo: today }
  }

  // "yesterday"
  if (/\byesterday\b/i.test(query)) {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    const ys = y.toISOString().slice(0, 10)
    return { dateFrom: ys, dateTo: ys }
  }

  // "last week" / "this week"
  if (/\blast\s*week\b/i.test(query)) {
    const from = new Date(now); from.setDate(from.getDate() - 14)
    const to   = new Date(now); to.setDate(to.getDate() - 7)
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) }
  }
  if (/\bthis\s*week\b/i.test(query)) {
    const from = new Date(now); from.setDate(from.getDate() - 7)
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: today }
  }

  // "last month" / "this month"
  if (/\blast\s*month\b/i.test(query)) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to   = new Date(now.getFullYear(), now.getMonth(), 0)
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) }
  }
  if (/\bthis\s*month\b/i.test(query)) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: today }
  }

  // "last 3 / 6 / 12 months"
  const monthsMatch = query.match(/\blast\s*(\d+)\s*months?\b/i)
  if (monthsMatch) {
    const n    = parseInt(monthsMatch[1]!)
    const from = new Date(now); from.setMonth(from.getMonth() - n)
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: today }
  }

  // "last year"
  if (/\blast\s*year\b/i.test(query)) {
    const from = new Date(now.getFullYear() - 1, 0, 1)
    const to   = new Date(now.getFullYear() - 1, 11, 31)
    return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) }
  }

  // "in January", "in March 2024", etc.
  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december']
  for (let mi = 0; mi < monthNames.length; mi++) {
    const re = new RegExp(`\\bin\\s*${monthNames[mi]}(?:\\s*(\\d{4}))?\\b`, 'i')
    const m  = query.match(re)
    if (m) {
      const year = m[1] ? parseInt(m[1]) : now.getFullYear()
      const from = new Date(year, mi, 1)
      const to   = new Date(year, mi + 1, 0)
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) }
    }
  }

  return {}
}

// ─── Amount range parsing ─────────────────────────────────────────────────────

function parseAmounts(query: string): { minAmount?: number; maxAmount?: number } {
  // "above 500", "over 1000", "more than 2000"
  const above = query.match(/\b(?:above|over|more\s*than|greater\s*than|>)\s*[₹$]?\s*(\d[\d,]*)/i)

  // "below 500", "under 1000", "less than 2000"
  const below = query.match(/\b(?:below|under|less\s*than|<)\s*[₹$]?\s*(\d[\d,]*)/i)

  // "between 500 and 1000"
  const between = query.match(/\bbetween\s*[₹$]?\s*(\d[\d,]*)\s*(?:and|to|-)\s*[₹$]?\s*(\d[\d,]*)/i)

  if (between) {
    return {
      minAmount: parseInt(between[1]!.replace(/,/g, '')),
      maxAmount: parseInt(between[2]!.replace(/,/g, '')),
    }
  }

  return {
    minAmount: above ? parseInt(above[1]!.replace(/,/g, '')) : undefined,
    maxAmount: below ? parseInt(below[1]!.replace(/,/g, '')) : undefined,
  }
}

// ─── Semantic tag parsing ─────────────────────────────────────────────────────

function parseSemanticTags(query: string): string[] {
  const tags: string[] = []
  if (/\b(gst|tax\s*invoice)\b/i.test(query)) tags.push('gst-invoice')
  if (/\b(refund|return|credit)\b/i.test(query)) tags.push('refund')
  if (/\b(subscription|monthly|recurring)\b/i.test(query)) tags.push('subscription')
  if (/\b(discount|cashback|offer)\b/i.test(query)) tags.push('discount-applied')
  if (/\b(business|corporate|work|company)\b/i.test(query)) tags.push('business-expense')
  return tags
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseNlQuery(raw: string): ParsedQuery {
  const q = raw.trim()

  // Detect intent
  let intent: ParsedQuery['intent'] = 'search'
  for (const [re, i] of INTENT_PATTERNS) {
    if (re.test(q)) { intent = i; break }
  }

  // Expense category
  let expenseCategory: ExpenseCategory | undefined
  for (const [re, cat] of EXPENSE_CATEGORY_NL) {
    if (re.test(q)) { expenseCategory = cat; break }
  }

  // Document category
  let category: string | undefined
  for (const [re, cat] of DOC_CATEGORY_NL) {
    if (re.test(q)) { category = cat; break }
  }

  const dates       = parseDateRange(q)
  const amounts     = parseAmounts(q)
  const tags        = parseSemanticTags(q)

  // Build a cleaned semantic query (remove filter words, keep meaning words)
  const semanticQuery = q
    .replace(/\b(show|find|get|list|fetch|give|tell|display|search)\b/gi, '')
    .replace(/\b(last|this|today|yesterday|week|month|year|above|below|over|under|between|and)\b/gi, '')
    .replace(/[₹$]\s*\d[\d,]*/g, '')
    .replace(/\b\d[\d,]+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    raw,
    semanticQuery: semanticQuery || q,
    category,
    expenseCategory,
    minAmount:    amounts.minAmount,
    maxAmount:    amounts.maxAmount,
    dateFrom:     dates.dateFrom,
    dateTo:       dates.dateTo,
    semanticTags: tags.length ? tags : undefined,
    intent,
  }
}

// ─── Query explanation (for UI tooltip) ──────────────────────────────────────

export function explainQuery(parsed: ParsedQuery): string {
  const parts: string[] = []

  if (parsed.expenseCategory) parts.push(`Category: ${parsed.expenseCategory}`)
  if (parsed.category)        parts.push(`Doc type: ${parsed.category}`)
  if (parsed.minAmount)       parts.push(`Amount ≥ ₹${parsed.minAmount.toLocaleString()}`)
  if (parsed.maxAmount)       parts.push(`Amount ≤ ₹${parsed.maxAmount.toLocaleString()}`)
  if (parsed.dateFrom)        parts.push(`From: ${parsed.dateFrom}`)
  if (parsed.dateTo)          parts.push(`To: ${parsed.dateTo}`)
  if (parsed.semanticTags?.length) parts.push(`Tags: ${parsed.semanticTags.join(', ')}`)

  return parts.length ? parts.join(' · ') : 'Semantic search across all documents'
}
