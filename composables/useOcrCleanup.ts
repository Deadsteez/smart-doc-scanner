//Cleans OCR text by fixing common recognition errors and formatting issues

export function cleanOcrText(raw: string, preserveTables: boolean = true): string {
  if (!raw || !raw.trim()) return ''

  let cleaned = raw
    
    .replace(/[~_]{2,}/g, ' ')

    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[…]/g, '...')

    .replace(/\b0([A-Z]{2,})\b/g, 'O$1')
    .replace(/\bO(\d+)\b/g, '0$1')
    .replace(/\b([A-Z])l([A-Z])\b/g, '$1I$2')
    .replace(/\bl([A-Z]{2,})/g, 'I$1')
    .replace(/([a-z])1([a-z])/g, '$1l$2')
    
    .replace(/\$\s+(\d)/g, '$$1')
    .replace(/₹\s+(\d)/g, '₹$1')
    
    .replace(/(\d)\s*,\s*(\d{3})/g, '$1,$2')
    
    .replace(/\s*\|\s*/g, preserveTables ? ' | ' : ' ')
   
    .replace(/\.{3,}/g, '...')
    .replace(/([.!?])\1{2,}/g, '$1')
    .replace(/\s+([.,;:!?])/g, '$1')
    
    .split('\n')
    .map(line => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter(line => line.length > 0)
   
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

  if (stripped.length < 10) return false

  const validCharsRatio = (stripped.match(/[a-zA-Z0-9\u0900-\u097F]/g) || []).length / stripped.length
  if (validCharsRatio < 0.3) return false

  return true
}

export function extractOcrPatterns(text: string) {
    return {
        emails: text.match(/\b[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}\b/g) || [],
       
        phones: text.match(/\b(?:\+?1[-.]?)?\(?(\d{3})\)?[-.]?(\d{3})[-.]?(\d{4})\b/g) || [],
      
        dates: text.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/\d{2,4}\b/g) || [],
        
        amounts: text.match(/\$\d+(?:,\d{3})*(?:\.\d{2})?/g) || [],
        urls: text.match(/https?:\/\/[^\s]+/g) || []
    }
}