import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface DocumentRecord {
  id?: number
  createdAt: number
  image: string
  ocrText: string
  cleanedText: string
  extracted: {
    vendor?: string
    date?: string
    total?: string
    receiptNumber?: string
  }
  category: 'invoice' | 'receipt' | 'other'
  synced: boolean
}

class DocumentDB extends Dexie {
  documents!: Table<DocumentRecord, number>

  constructor() {
    super('SmartDocScannerDB')
    this.version(1).stores({
      documents: '++id, createdAt, synced'
    })
  }
}

export const db = new DocumentDB()
