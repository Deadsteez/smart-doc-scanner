/** 
 * Cleans OCR text by fixing common recognition errors and formatting issues
 * @param raw - Raw OCR output text
 * @param preserveTables - Whether to preserve table separators (|)
 * @returns Cleaned text
 */
export function cleanOcrText(raw: string, preserveTables: boolean = true): string {
  if (!raw || !raw.trim()) return ''

  let cleaned = raw
    // Fix common OCR symbol noise
    .replace(/[~_]{2,}/g, ' ')
    // Normalize unicode quotes and dashes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[…]/g, '...')
    // Fix common OCR letter/number confusions
    .replace(/\b0([A-Z]{2,})\b/g, 'O$1')
    .replace(/\bO(\d+)\b/g, '0$1')
    .replace(/\b([A-Z])l([A-Z])\b/g, '$1I$2')
    .replace(/\bl([A-Z]{2,})/g, 'I$1')
    .replace(/([a-z])1([a-z])/g, '$1l$2')
    // Fix currency spacing
    .replace(/\$\s+(\d)/g, '$$1')
    .replace(/₹\s+(\d)/g, '₹$1')
    // Fix number formatting
    .replace(/(\d)\s*,\s*(\d{3})/g, '$1,$2')
    // Normalize table separators
    .replace(/\s*\|\s*/g, preserveTables ? ' | ' : ' ')
    // Clean up punctuation spacing
    .replace(/\.{3,}/g, '...')
    .replace(/([.!?])\1{2,}/g, '$1')
    .replace(/\s+([.,;:!?])/g, '$1')
    // Normalize horizontal whitespace per line — but PRESERVE newlines
    // (collapsing newlines destroys line-item structure needed for field extraction)
    .split('\n')
    .map(line => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter(line => line.length > 0)
    // Collapse 3+ consecutive blank lines to 2 max
    .reduce((acc: string[], line) => {
      const trailingBlanks = acc.slice(-2).filter(l => l === '').length
      if (line === '' && trailingBlanks >= 2) return acc
      acc.push(line)
      return acc
    }, [])
    .join('\n')
    .trim()

  return cleaned
}

export function isValidOcrOutput(text: string): boolean {
  if (!text || text.trim().length < 10) return false

  const stripped = text.replace(/\s/g, '')

  // Need at least 10 non-whitespace characters
  if (stripped.length < 10) return false

  // Check for alphanumeric (English) OR Unicode letters (Hindi, Marathi, etc.)
  // \p{L} matches any Unicode letter, \p{N} matches any Unicode number
  const validCharsRatio = (stripped.match(/[a-zA-Z0-9\u0900-\u097F]/g) || []).length / stripped.length
  if (validCharsRatio < 0.3) return false

  return true
}

export function extractOcrPatterns(text: string) {
    return {
        emails: text.match(/\b[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}\b/g) || [],
        
        // Handles (123) 456-7890, +1-123-456-7890, etc.
        phones: text.match(/\b(?:\+?1[-.]?)?\(?(\d{3})\)?[-.]?(\d{3})[-.]?(\d{4})\b/g) || [],
        
        //Validates month (1-12) and day (1-31)
        dates: text.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/\d{2,4}\b/g) || [],
        
        amounts: text.match(/\$\d+(?:,\d{3})*(?:\.\d{2})?/g) || [],
        urls: text.match(/https?:\/\/[^\s]+/g) || []
    }
}