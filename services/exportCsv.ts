import type { DocumentRecord } from '~/services/db'

export function exportDocumentsToCSV(docs: DocumentRecord[]) {
  if (!docs.length) return

  const headers = [
    'id',
    'createdAt',
    'category',
    'vendor',
    'date',
    'total',
    'receiptNumber'
  ]

  const rows = docs.map(d => [
    d.id ?? '',
    new Date(d.createdAt).toISOString(),
    d.category,
    d.extracted.vendor ?? '',
    d.extracted.date ?? '',
    d.extracted.total ?? '',
    d.extracted.receiptNumber ?? ''
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
  link.setAttribute('download', 'documents.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
