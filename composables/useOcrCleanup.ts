export function cleanOcrText(raw: string): string {
  return raw
    .replace(/[~_]+/g, ' ')              // remove placeholders
    .replace(/[^\S\r\n]+/g, ' ')         // normalize spaces
    .replace(/\n{3,}/g, '\n\n')           // collapse excessive newlines
    .replace(/[|]/g, 'I')                 // common OCR confusion
    .trim()
}
