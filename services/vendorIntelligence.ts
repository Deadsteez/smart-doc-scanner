
export type ExpenseCategory =
  | 'food'
  | 'fuel'
  | 'transport'
  | 'utilities'
  | 'shopping'
  | 'medical'
  | 'office'
  | 'entertainment'
  | 'financial'
  | 'education'
  | 'other'

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food:          '🍽️ Food & Dining',
  fuel:          '⛽ Fuel',
  transport:     '🚌 Transport & Travel',
  utilities:     '⚡ Utilities',
  shopping:      '🛍️ Shopping',
  medical:       '🏥 Medical & Health',
  office:        '💼 Office & Business',
  entertainment: '🎬 Entertainment',
  financial:     '🏦 Financial Services',
  education:     '📚 Education',
  other:         '📦 Other',
}

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  food:          '#f97316',   // orange
  fuel:          '#eab308',   // yellow
  transport:     '#3b82f6',   // blue
  utilities:     '#8b5cf6',   // violet
  shopping:      '#ec4899',   // pink
  medical:       '#22c55e',   // green
  office:        '#64748b',   // slate
  entertainment: '#a855f7',   // purple
  financial:     '#0ea5e9',   // sky
  education:     '#14b8a6',   // teal
  other:         '#475569',   // muted slate
}

const VENDOR_RULES: [RegExp, ExpenseCategory][] = [
  [/\b(swiggy|zomato|uber\s*eats|food\s*panda|blinkit|dunzo|zepto|bigbasket|grofers)\b/i, 'food'],
  [/\b(domino'?s?|pizza\s*hut|kfc|mcdonald'?s?|burger\s*king|subway|starbucks|ccd|barista|cafe\s*coffee\s*day)\b/i, 'food'],
  [/\b(biryani|dhaba|restaurant|cafe|canteen|food|bakery|sweet\s*shop|mithai|halwai|tiffin|hotel)\b/i, 'food'],
  [/\b(haldiram|bikanervala|amul|mother\s*dairy|britannia|parle)\b/i, 'food'],

  [/\b(indian\s*oil|iocl|hp\s*(gas|petroleum)?|hpcl|bharat\s*petroleum|bpcl|shell|essar|reliance\s*petro)\b/i, 'fuel'],
  [/\b(petrol|diesel|fuel\s*(station|pump)|cng|lpg|gas\s*station|filling\s*station|bunker)\b/i, 'fuel'],

  [/\b(ola|uber|rapido|meru|jugnoo|blablacar|bounce|yulu|drivezy)\b/i, 'transport'],
  [/\b(irctc|indian\s*railways|railway|metro|pmpml|bmtc|best\s*bus|ksrtc|msrtc|bus\s*stand)\b/i, 'transport'],
  [/\b(air\s*india|indigo|spicejet|go\s*air|vistara|emirates|qatar|singapore\s*airlines)\b/i, 'transport'],
  [/\b(makemytrip|yatra|booking\.com|hotels?\.com|airbnb|oyo|treebo|fabhotel)\b/i, 'transport'],
  [/\b(parking|toll|fastag|highway|expressway)\b/i, 'transport'],

  [/\b(bescom|msedcl|tata\s*power|adani\s*(electricity|gas)|torrent\s*power|cesc|merc|wbsedcl)\b/i, 'utilities'],
  [/\b(jio|airtel|bsnl|vodafone|vi\b|idea|act\s*fibernet|hathway|tikona|beam\s*fiber)\b/i, 'utilities'],
  [/\b(electricity|water\s*bill|gas\s*bill|broadband|wifi|dth|tata\s*sky|dish\s*tv|sun\s*direct)\b/i, 'utilities'],
  [/\b(mahanagar\s*gas|indraprastha\s*gas|gujarat\s*gas|piped\s*gas)\b/i, 'utilities'],

  [/\b(amazon|flipkart|myntra|ajio|nykaa|meesho|snapdeal|tata\s*cliq|croma|vijay\s*sales)\b/i, 'shopping'],
  [/\b(dmart|big\s*bazaar|reliance\s*(fresh|smart|digital)|spencer'?s?|more\s*supermarket|star\s*bazaar)\b/i, 'shopping'],
  [/\b(walmart|ikea|h&m|zara|marks\s*(and|&)\s*spencer|max\s*fashion|westside|lifestyle)\b/i, 'shopping'],

  [/\b(apollo|fortis|manipal|narayana|columbia\s*asia|max\s*hospital|aiims|nimhans)\b/i, 'medical'],
  [/\b(medplus|netmeds|1mg|pharmeasy|tata\s*(1mg|health)|practo|lybrate)\b/i, 'medical'],
  [/\b(pharmacy|chemist|medical\s*store|hospital|clinic|lab|diagnostic|pathology|x[-\s]?ray|scan)\b/i, 'medical'],
  [/\b(health\s*insurance|star\s*health|niva\s*bupa|care\s*health|bajaj\s*allianz)\b/i, 'medical'],

  [/\b(netflix|hotstar|prime\s*video|sony\s*liv|zee5|mxplayer|voot|jiocinema|aha)\b/i, 'entertainment'],
  [/\b(spotify|gaana|jiosaavn|wynk|hungama)\b/i, 'entertainment'],
  [/\b(bookmyshow|pvr|inox|cinepolis|carnival\s*cinemas|fun\s*cinemas)\b/i, 'entertainment'],
  [/\b(gaming|playstation|xbox|steam|epic\s*games|google\s*play|app\s*store)\b/i, 'entertainment'],

  [/\b(hdfc|icici|sbi|axis\s*bank|kotak|yes\s*bank|idbi|pnb|canara|bank\s*of\s*india)\b/i, 'financial'],
  [/\b(lic|bajaj\s*finserv|policybazaar|paytm\s*(insurance|money)|zerodha|groww|upstox)\b/i, 'financial'],
  [/\b(mutual\s*fund|sip|insurance\s*premium|emi|loan\s*repayment|credit\s*card\s*bill)\b/i, 'financial'],

  [/\b(byju'?s?|unacademy|vedantu|coursera|udemy|skillshare|khan\s*academy|toppr)\b/i, 'education'],
  [/\b(school\s*fee|tuition|college\s*fee|university|coaching|exam\s*fee|cbse|icse)\b/i, 'education'],

  [/\b(amazon\s*business|indiamart|tradeindia|alibaba|dhl|fedex|bluedart|dtdc|ekart)\b/i, 'office'],
  [/\b(stationery|printer\s*ink|office\s*supplies|co[-\s]?working|we\s*work|awfis)\b/i, 'office'],
  [/\b(microsoft|google\s*(workspace|cloud)|aws|azure|notion|slack|zoom)\b/i, 'office'],
]

const TAG_RULES: [RegExp, string][] = [
  [/\b(gstin|gst\s*(no|number|invoice)|tax\s*invoice)\b/i,                   'gst-invoice'],
  [/\b(refund|return|credit\s*note|reversal)\b/i,                             'refund'],
  [/\bemi\b|\binstallment\b|\bmonthly\s*(charge|fee|subscription|plan)\b/i,   'subscription'],
  [/\b(warranty|guarantee|service\s*contract)\b/i,                            'warranty'],
  [/\b(advance|deposit|booking\s*amount)\b/i,                                 'advance-payment'],
  [/\b(tip|gratuity|service\s*charge)\b/i,                                    'service-charge'],
  [/\b(discount|offer|coupon|cashback|promo)\b/i,                             'discount-applied'],
  [/\b(split\s*bill|dutch|group\s*order)\b/i,                                 'split-bill'],
  [/\b(corporate|business\s*(expense|purchase)|company\s*card)\b/i,           'business-expense'],
  [/\b(urgent|asap|priority|express)\b/i,                                     'express-service'],
]

/**
 * Classify a document into an expense category based on vendor name + OCR text.
 * This is SEMANTIC ENRICHMENT — the system understands WHAT the vendor IS.
 */
export function inferExpenseCategory(
  text: string,
  vendor?: string
): ExpenseCategory {
  const haystack = [vendor ?? '', text].join(' ')

  for (const [pattern, category] of VENDOR_RULES) {
    if (pattern.test(haystack)) return category
  }

  return 'other'
}

/**
 * Extract semantic tags from document text.
 * Tags add meaning beyond the basic category.
 */
export function extractSemanticTags(text: string): string[] {
  const tags: string[] = []
  for (const [pattern, tag] of TAG_RULES) {
    if (pattern.test(text)) tags.push(tag)
  }
  return tags
}

/**
 * Get a human-readable description of the vendor's semantic meaning.
 * Used for smart suggestions on the scan page.
 */
export function getVendorSemantic(vendor?: string, text?: string): string | undefined {
  if (!vendor && !text) return undefined
  const haystack = [vendor ?? '', text ?? ''].join(' ')

  const semantics: [RegExp, string][] = [
    [/\bswiggy\b/i,       'food delivery platform'],
    [/\bzomato\b/i,       'food delivery platform'],
    [/\bindian\s*oil\b/i, 'fuel / petroleum vendor'],
    [/\bhpcl\b|\bhp\s*petrol\b/i, 'fuel / petroleum vendor'],
    [/\bbpcl\b|\bbharat\s*petrol\b/i, 'fuel / petroleum vendor'],
    [/\birctc\b/i,        'Indian Railways booking'],
    [/\bpmpml\b/i,        'Pune city bus transport'],
    [/\bapollo\b/i,       'healthcare / hospital'],
    [/\bbes(com|t)\b/i,   'electricity utility board'],
    [/\bairtel\b/i,       'telecom / internet provider'],
    [/\bjio\b/i,          'telecom / internet provider'],
    [/\bamazon\b/i,       'e-commerce / online shopping'],
    [/\bflipcart\b/i,     'e-commerce / online shopping'],
    [/\bnetflix\b/i,      'video streaming subscription'],
    [/\bspotify\b/i,      'music streaming subscription'],
  ]

  for (const [re, desc] of semantics) {
    if (re.test(haystack)) return desc
  }
  return undefined
}

/**
 * Aggregate expense categories from a list of documents.
 * Returns monthly totals per category — used for the expense analytics widget.
 */
export function aggregateExpenses(docs: Array<{
  expenseCategory?: string
  extracted?: { total?: string; currency?: string; date?: string }
  createdAt: number
}>): Record<string, { total: number; count: number; currency: string }> {
  const result: Record<string, { total: number; count: number; currency: string }> = {}

  for (const doc of docs) {
    const cat      = doc.expenseCategory ?? 'other'
    const rawTotal = doc.extracted?.total
    const ccy      = doc.extracted?.currency ?? 'INR'

    if (!rawTotal) continue
    const amount = parseFloat(rawTotal.replace(/[,\s]/g, ''))
    if (isNaN(amount) || amount <= 0) continue

    if (!result[cat]) result[cat] = { total: 0, count: 0, currency: ccy }
    result[cat].total += amount
    result[cat].count += 1
  }

  return result
}
