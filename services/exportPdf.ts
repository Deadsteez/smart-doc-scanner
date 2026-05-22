import jsPDF from 'jspdf'
import type { DocumentRecord } from '~/services/db'

async function resolveImageBase64(image: string): Promise<string | null> {
  try {
    if (image.startsWith('data:')) return image

    const response = await fetch(image)
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function detectImageFormat(base64: string): 'JPEG' | 'PNG' | 'WEBP' {
  if (base64.startsWith('data:image/png')) return 'PNG'
  if (base64.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

function calcImageHeight(base64: string, maxWidth: number): Promise<number> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth
      resolve(Math.min(maxWidth * ratio, 200))
    }
    img.onerror = () => resolve(150)
    img.src = base64
  })
}

function truncate(value: string, maxLen: number): string {
  return value.length > maxLen ? value.substring(0, maxLen) + '…' : value
}

function drawRule(pdf: jsPDF, y: number): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  pdf.setDrawColor(200)
  pdf.line(20, y, pageWidth - 20, y)
  pdf.setDrawColor(0)
}

export async function exportDocumentToPDF(doc: DocumentRecord): Promise<boolean> {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2

  let y = 20

  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Document Details', pageWidth / 2, y, { align: 'center' })
  y += 8

  drawRule(pdf, y)
  y += 10

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Exported: ${new Date().toLocaleString()}`, margin, y)
  y += 6
  pdf.text(`Created:  ${new Date(doc.createdAt).toLocaleString()}`, margin, y)
  y += 6
  pdf.text(`Sync Status: ${doc.synced ? 'Synced' : 'Pending'}`, margin, y)
  y += 12

  pdf.setFontSize(13)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Extracted Information', margin, y)
  y += 6
  drawRule(pdf, y)
  y += 8

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  const confidence = doc.category?.confidence
    ? Math.round(doc.category.confidence * 100) + '%'
    : 'N/A'

  const metaFields = [
    { label: 'Category',            value: doc.category?.type ?? 'N/A' },
    { label: 'NLP Label',           value: doc.category?.nlpLabel ?? 'N/A' },
    { label: 'Confidence',          value: confidence },
    { label: 'Vendor',              value: doc.extracted?.vendor },
    { label: 'Date',                value: doc.extracted?.date },
    { label: 'Total',               value: doc.extracted?.total ? `$${doc.extracted.total}` : undefined },
    { label: 'Tax',                 value: doc.extracted?.tax ? `$${doc.extracted.tax}` : undefined },
    { label: 'Receipt / Invoice #', value: doc.extracted?.receiptNumber },
    { label: 'Payment Method',      value: doc.extracted?.paymentMethod },
  ]

  for (const field of metaFields) {
    if (!field.value) continue
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${field.label}:`, margin, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(field.value, margin + 50, y)
    y += 7
  }

  if (doc.extracted?.items?.length) {
    y += 5

    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Line Items', margin, y)
    y += 6
    drawRule(pdf, y)
    y += 8

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.text('#', margin, y)
    pdf.text('Description', margin + 10, y)
    pdf.text('Amount', pageWidth - margin - 20, y, { align: 'right' })
    y += 5
    drawRule(pdf, y)
    y += 5

    pdf.setFont('helvetica', 'normal')

    doc.extracted.items.forEach((item, index) => {
      if (y > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(String(index + 1), margin, y)
      pdf.text(truncate(item.description, 50), margin + 10, y)
      pdf.text(`$${item.amount}`, pageWidth - margin - 20, y, { align: 'right' })
      y += 6
    })

    y += 2
    drawRule(pdf, y)
    y += 5
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${doc.extracted.items.length} item(s)`, margin + 10, y)
    y += 8
  }

  if (doc.image) {
    pdf.addPage()
    y = margin

    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Scanned Image', pageWidth / 2, y, { align: 'center' })
    y += 6
    drawRule(pdf, y)
    y += 10

    try {
      const base64 = await resolveImageBase64(doc.image)

      if (base64) {
        const imgHeight = await calcImageHeight(base64, contentWidth)
        const format = detectImageFormat(base64)

        if (y + imgHeight > pageHeight - margin) {
          pdf.addPage()
          y = margin
        }

        pdf.addImage(base64, format, margin, y, contentWidth, imgHeight)
        y += imgHeight + 10
      } else {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.text('Image could not be loaded.', margin, y)
      }
    } catch (err) {
      console.error('[PDF] Failed to embed image:', err)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('Image could not be embedded.', margin, y)
    }
  }

  if (doc.cleanedText) {
    pdf.addPage()
    y = margin

    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'bold')
    pdf.text('OCR Text', margin, y)
    y += 6
    drawRule(pdf, y)
    y += 8

    pdf.setFontSize(9)
    pdf.setFont('courier', 'normal')

    const lines = pdf.splitTextToSize(doc.cleanedText, contentWidth)

    for (const line of lines) {
      if (y > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(line, margin, y)
      y += 5
    }
  }

  const filename = `document_${doc.id ?? 'new'}_${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(filename)
  return true
}

export function exportMultipleDocumentsToPDF(docs: DocumentRecord[]): boolean {
  if (!docs.length) return false

  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20

  pdf.setFontSize(22)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Document Export', pageWidth / 2, 40, { align: 'center' })

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Total Documents: ${docs.length}`, pageWidth / 2, 55, { align: 'center' })
  pdf.text(`Export Date: ${new Date().toLocaleString()}`, pageWidth / 2, 63, { align: 'center' })

  let y = 80

  drawRule(pdf, y)
  y += 10

  const COL = { id: 20, category: 40, vendor: 82, date: 132, total: 172 }

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text('ID',        COL.id,       y)
  pdf.text('Category',  COL.category, y)
  pdf.text('Vendor',    COL.vendor,   y)
  pdf.text('Date',      COL.date,     y)
  pdf.text('Total ($)', COL.total,    y)
  y += 4

  drawRule(pdf, y)
  y += 5

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)

  docs.forEach((doc, i) => {
    if (y > pageHeight - margin) {
      pdf.addPage()
      y = margin
    }

    if (i % 2 === 0) {
      pdf.setFillColor(245, 245, 245)
      pdf.rect(margin - 2, y - 4, pageWidth - margin * 2 + 4, 7, 'F')
    }

    pdf.setTextColor(0)
    pdf.text(String(doc.id ?? '—'),                                          COL.id,       y)
    pdf.text(doc.category?.type ?? '—',                                      COL.category, y)
    pdf.text(truncate(doc.extracted?.vendor ?? '—', 22),                     COL.vendor,   y)
    pdf.text(doc.extracted?.date ?? '—',                                     COL.date,     y)
    pdf.text(doc.extracted?.total ? `$${doc.extracted.total}` : '—',         COL.total,    y)

    y += 7
  })

  y += 4
  drawRule(pdf, y)

  const filename = `documents_export_${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(filename)
  return true
}