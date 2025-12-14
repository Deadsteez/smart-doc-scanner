import { defineStore } from 'pinia'
import { db } from '~/services/db'
import type { DocumentRecord } from '~/services/db'

export const useDocumentStore = defineStore('documents', {
  state: () => ({
    documents: [] as DocumentRecord[]
  }),

  actions: {
    async loadAll() {
      this.documents = await db.documents
        .orderBy('createdAt')
        .reverse()
        .toArray()
    },

    async add(doc: DocumentRecord) {
      await db.documents.add(doc)
      await this.loadAll()
    }
  }
})
