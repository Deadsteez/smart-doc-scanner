

export function normalizeToIsoDate(raw: string): string {
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
 
  const match = raw.match(
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i
  )
  if (match) {
    const d2 = new Date(`${match[2]} ${match[1]} ${match[3]}`)
    if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10)
  }
  return raw
}

export function cleanOcrText(raw: string, preserveTables: boolean = true): string {
  if (!raw || !raw.trim()) return ''

 
  let cleaned = raw
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[…]/g, '...')

  
  cleaned = cleaned
    .replace(/Ã¢â€šÂ¹|ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¹|â‚¹|₹/g, '₹')   
    .replace(/\bR(?=\s*\d{1,6}(?:\.\d{1,2})?\b)/g, '₹')     
    .replace(/\bRS(?=\s*\d{1,6}(?:\.\d{1,2})?\b)/gi, 'Rs') 
    .replace(/\b(?:rs|rs\.|inr)\b/gi, 'Rs')                   

 
  cleaned = cleaned.replace(
    /(?<!\d)\b2\s+(\d{2,4}(?:[,.]\d+)?)\b/g,
    '₹ $1'
  )

  
  cleaned = cleaned.replace(/^2(\d{2,3})\b/gm, (match, digits) => {
    const full = parseInt('2' + digits, 10)
    if (full >= 2000 && full <= 2099) return match   
    if (full > 2200) return match                    
    return `₹${digits}`
  })

 
  cleaned = cleaned
    .replace(/\$\s+(\d)/g, '$$$1')   
    .replace(/₹\s+(\d)/g, '₹$1')    

 
  cleaned = cleaned
    .replace(/(\d)\s*,\s*(\d{3})/g, '$1,$2')  
  cleaned = cleaned
   
    .replace(/\bO(\d+)\b/g, '0$1')             
    .replace(/(?<=\d)[oO](?=\d)/g, '0')         
   
    .replace(/\b0([A-Z]{2,})\b/g, 'O$1')         
    .replace(/\b([A-Z])l([A-Z])\b/g, '$1I$2')   
    .replace(/\bl([A-Z]{2,})/g, 'I$1')        
    .replace(/([a-z])1([a-z])/g, '$1l$2')        
    .replace(/\|/g, 'I')

  cleaned = cleaned
     .replace(/[~_]{2,}/g, ' ')           
    .replace(/\.{3,}/g, '...')                   
    .replace(/([.!?])\1{2,}/g, '$1')             
    .replace(/\s+([.,;:!?])/g, '$1')             
    .replace(/\s*\|\s*/g, preserveTables ? ' | ' : ' ')

  const lines = cleaned
    .split('\n')
    .map(line => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter(line => line.length > 0)

  
  const collapsed: string[] = []
  let blankCount = 0
  for (const line of lines) {
    if (line === '') {
      blankCount++
      if (blankCount <= 1) collapsed.push(line)
    } else {
      blankCount = 0
      collapsed.push(line)
    }
  }

  return collapsed.join('\n').trim()
}

export function isValidOcrOutput(text: string): boolean {
  if (!text?.trim()) return false

  const stripped = text.replace(/\s/g, '')
  if (stripped.length < 10) return false

  
  const validChars = stripped.match(/[a-zA-Z0-9\u0900-\u097F.,\-$₹@]/g) ?? []
  if (validChars.length / stripped.length < 0.3) return false

  return true
}

export interface OcrPatterns {
  emails: string[]
  phones: string[]
  dates: string[]
  amounts: string[]
  urls: string[]
}

export function extractOcrPatterns(text: string): OcrPatterns {
  return {
    emails: text.match(
      /\b[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}\b/g
    ) ?? [],

    phones: text.match(
      /(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g
    ) ?? [],

    dates: [
  ...(text.match(
    /\b(?:(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/\d{2,4}|(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/\d{2,4}|\d{4}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01]))\b/g
  ) ?? []),
  ...(text.match(
    /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/gi
  ) ?? []),
].map(normalizeToIsoDate),

    
    amounts: text.match(/[$₹][\d,]+(?:\.\d{1,2})?/g) ?? [],

    urls: (text.match(/https?:\/\/[^\s]+/g) ?? []).map(u => u.replace(/[.,;!?]+$/, '')),
  }
}