
import jsPDF from 'jspdf'
import type { DocumentRecord } from '~/services/db'

export function exportDocumentToPDF(doc: DocumentRecord) {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  let yPos = 20

  // Title
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Document Details', pageWidth / 2, yPos, { align: 'center' })
  yPos += 15

  // Document metadata
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Date: ${new Date(doc.createdAt).toLocaleString()}`, 20, yPos)
  yPos += 7
  pdf.text(`Category: ${doc.category?.type ?? 'N/A'}`, 20, yPos)
  yPos += 7
  pdf.text(`Confidence: ${doc.category?.confidence ? Math.round(doc.category.confidence * 100) + '%' : 'N/A'}`, 20, yPos)
  yPos += 12

  // Extracted fields section
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Extracted Information', 20, yPos)
  yPos += 10

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  const fields = [
    { label: 'Vendor', value: doc.extracted?.vendor },
    { label: 'Date', value: doc.extracted?.date },
    { label: 'Total', value: doc.extracted?.total },
    { label: 'Tax', value: doc.extracted?.tax },
    { label: 'Receipt/Invoice #', value: doc.extracted?.receiptNumber },
    { label: 'Payment Method', value: doc.extracted?.paymentMethod }
  ]

  fields.forEach(field => {
    if (field.value) {
      pdf.text(`${field.label}: ${field.value}`, 20, yPos)
      yPos += 7
    }
  })

  // Line items
  if (doc.extracted?.items && doc.extracted.items.length > 0) {
    yPos += 5
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Line Items', 20, yPos)
    yPos += 10

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')

    doc.extracted.items.forEach((item, index) => {
      if (yPos > pageHeight - 20) {
        pdf.addPage()
        yPos = 20
      }
      pdf.text(`${index + 1}. ${item.description}`, 25, yPos)
      pdf.text(item.amount, pageWidth - 40, yPos, { align: 'right' })
      yPos += 6
    })
  }

  // Add new page for image
  pdf.addPage()
  yPos = 20

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Scanned Image', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  // Add document image
  if (doc.image) {
    try {
      const imgWidth = pageWidth - 40
      const imgHeight = 150
      pdf.addImage(doc.image, 'JPEG', 20, yPos, imgWidth, imgHeight)
      yPos += imgHeight + 10
    } catch (err) {
      console.error('Failed to add image to PDF:', err)
      pdf.text('Image could not be embedded', 20, yPos)
      yPos += 10
    }
  }

  // Add new page for OCR text
  if (doc.cleanedText) {
    pdf.addPage()
    yPos = 20

    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('OCR Text', 20, yPos)
    yPos += 10

    pdf.setFontSize(9)
    pdf.setFont('courier', 'normal')

    const lines = pdf.splitTextToSize(doc.cleanedText, pageWidth - 40)
    lines.forEach((line: string) => {
      if (yPos > pageHeight - 20) {
        pdf.addPage()
        yPos = 20
      }
      pdf.text(line, 20, yPos)
      yPos += 5
    })
  }

  // Save PDF
  const filename = `document_${doc.id}_${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(filename)
}

export function exportMultipleDocumentsToPDF(docs: DocumentRecord[]) {
  if (!docs.length) return

  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Title page
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Document Export', pageWidth / 2, 40, { align: 'center' })
  
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Total Documents: ${docs.length}`, pageWidth / 2, 55, { align: 'center' })
  pdf.text(`Export Date: ${new Date().toLocaleString()}`, pageWidth / 2, 65, { align: 'center' })

  // Summary table
  let yPos = 85
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('ID', 20, yPos)
  pdf.text('Category', 40, yPos)
  pdf.text('Vendor', 80, yPos)
  pdf.text('Date', 130, yPos)
  pdf.text('Total', 170, yPos)
  yPos += 7

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)

  docs.forEach(doc => {
    if (yPos > pageHeight - 20) {
      pdf.addPage()
      yPos = 20
    }

    pdf.text(String(doc.id ?? ''), 20, yPos)
    pdf.text(doc.category?.type ?? '', 40, yPos)
    pdf.text((doc.extracted?.vendor ?? '').substring(0, 20), 80, yPos)
    pdf.text(doc.extracted?.date ?? '', 130, yPos)
    pdf.text(doc.extracted?.total ?? '', 170, yPos)
    yPos += 6
  })

  // Save PDF
  const filename = `documents_export_${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(filename)
}
