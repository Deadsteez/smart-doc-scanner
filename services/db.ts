import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface DocumentRecord {
  id?: number           // local Dexie auto-increment PK
  supabaseId?: string   // UUID from Supabase after sync
  userId?: string       // Supabase auth user UUID
  createdAt: number     // Unix ms timestamp
  image: string         // base64 data URL
  ocrText: string
  cleanedText: string
  extracted: {
    vendor?: string
    date?: string
    total?: string
    receiptNumber?: string
  }
  category: {
    type: 'invoice' | 'receipt' | 'other'
    confidence: number
    scores: { invoice: number; receipt: number }
  }
  synced: boolean       // false = pending Supabase upload
}

class DocumentDB extends Dexie {
  documents!: Table<DocumentRecord, number>

  constructor() {
    super('SmartDocScannerDB')
    this.version(2).stores({
      // Added supabaseId and userId to indexed fields
      documents: '++id, createdAt, synced, supabaseId, userId'
    })
  }
}

export const db = new DocumentDB()