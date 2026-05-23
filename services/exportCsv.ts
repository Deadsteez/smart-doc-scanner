import type { DocumentRecord } from '~/services/db'

export function exportDocumentsToCSV(docs: DocumentRecord[]):boolean {
  if (!docs.length) return false

  const headers = ['ID','Created At','Category','Confidence','Vendor','Date','Total', 'Tax','Receipt/Invoice Number','Payment Method','Items Count','Items Detail','Sync Status' ]

  const rows = docs.map(doc => {

    const itemsDetail =doc.extracted?.items?.map(i => `${i.description} ($${i.amount})`).join('; ') ?? ''

    const confidence = doc.category?.confidence? Math.round(doc.category.confidence * 100) + '%': ''

    return [
    doc.id ?? '',
    new Date(doc.createdAt).toLocaleString(),
    doc.category?.type ?? '',
    doc.category?.confidence ? Math.round(doc.category.confidence * 100) + '%' : '',
    doc.extracted?.vendor ?? '',
    doc.extracted?.date ?? '',
    doc.extracted?.total ?? '',
    doc.extracted?.tax ?? '',
    doc.extracted?.receiptNumber ?? '',
    doc.extracted?.paymentMethod ?? '',
    doc.extracted?.items?.length ?? 0,
    itemsDetail,
    doc.synced?'Synced':'Pending',
    ]
})

  const csv ='\uFEFF' +[headers, ...rows].map
  (row =>row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
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

  setTimeout(()=>URL.revokeObjectURL(url),1000)

  return true
}
