/** 
 * Cleans OCR text by fixing common recognition errors and formatting issues
 * @param raw - Raw OCR output text
 * @param preserveTables - Whether to preserve table separators (|)
 * @returns Cleaned text
 */
export function cleanOcrText(raw: string, preserveTables: boolean = true): string {
    if (!raw || !raw.trim()) {
        return ''
    }

    let cleaned = raw
        .replace(/[~_]{2,}/g, ' ')
        .replace(/[^\S\r\n]+/g, ' ')
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
        .replace(/(\d)\s*,\s*(\d{3})/g, '$1,$2')
        .replace(/\s*\|\s*/g, preserveTables ? ' | ' : ' ')
        .replace(/\.{3,}/g, '...')
        .replace(/([.!?])\1{2,}/g, '$1')
        .replace(/\s+([.,;:!?])/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s{2,}/g, ' ')
        .trim()

    return cleaned
}

export function isValidOcrOutput(text: string): boolean {
    if (!text || text.trim().length < 10) return false
    
    const alphanumericRatio = (text.match(/[a-zA-Z0-9]/g) || []).length / text.length
    if (alphanumericRatio < 0.5) return false
    
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