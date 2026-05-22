import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface LineItem {
  description: string
  amount: string
}

export interface ExtractedFields {
  vendor?: string
  date?: string
  total?: string
  tax?: string
  receiptNumber?: string
  paymentMethod?: string
  items?: LineItem[]
}

export interface DocumentRecord {
  id?: number
  supabaseId?: string
  userId?: string
  workspaceId?: string
  createdAt: number
  image: string
  ocrText: string
  cleanedText: string
  extracted: ExtractedFields
  category: {
    type: 'invoice' | 'receipt' | 'other'
    nlpLabel?: string       
    confidence: number
    scores: {
      invoice: number
      receipt: number
      bank_statement?: number
      other?: number
    }
  }
  synced: boolean
}

class DocumentDB extends Dexie {
  documents!: Table<DocumentRecord, number>

  constructor() {
    super('SmartDocScannerDB')
    this.version(4).stores({
      //Indexed DB schema
      documents: '++id, createdAt, synced, supabaseId, userId, workspaceId'
    })
  }
}

export const db = new DocumentDB()