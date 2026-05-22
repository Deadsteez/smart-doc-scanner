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

export interface CategoryScores {
  invoice: number
  receipt: number
  bank_statement: number
  payment_slip: number
  utility_bill: number
  tax_document: number
  contract: number
  other: number
}

export interface DocumentCategory {
  type: 'invoice' | 'receipt' | 'bank_statement' | 'payment_slip' | 'utility_bill' | 'tax_document' | 'contract' | 'other'
  nlpLabel?: string
  confidence: number
  scores: CategoryScores
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
  category: DocumentCategory
  synced: boolean
}

class DocumentDB extends Dexie {
  documents!: Table<DocumentRecord, number>

  constructor() {
    super('SmartDocScannerDB')
    this.version(4).stores({
      documents: '++id, createdAt, synced, supabaseId, userId, workspaceId'
    })
  }
}

export const db = new DocumentDB()