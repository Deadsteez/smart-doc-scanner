import type { DocumentRecord } from '~/services/db'

export function exportDocumentsToCSV(docs: DocumentRecord[]) {
  if (!docs.length) return

  const headers = [
    'ID',
    'Created At',
    'Category',
    'Confidence',
    'Vendor',
    'Date',
    'Total',
    'Tax',
    'Receipt/Invoice Number',
    'Payment Method',
    'Items Count'
  ]

  const rows = docs.map(d => [
    d.id ?? '',
    new Date(d.createdAt).toLocaleString(),
    d.category?.type ?? '',
    d.category?.confidence ? Math.round(d.category.confidence * 100) + '%' : '',
    d.extracted?.vendor ?? '',
    d.extracted?.date ?? '',
    d.extracted?.total ?? '',
    d.extracted?.tax ?? '',
    d.extracted?.receiptNumber ?? '',
    d.extracted?.paymentMethod ?? '',
    d.extracted?.items?.length ?? 0
  ])

  const csv =
    [headers, ...rows]
      .map(row =>
        row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  const timestamp = new Date().toISOString().split('T')[0]
  link.setAttribute('download', `documents_${timestamp}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
