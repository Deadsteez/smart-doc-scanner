import { defineStore } from 'pinia'
import { db } from '~/services/db'
import type { DocumentRecord } from '~/services/db'

export const useDocumentStore = defineStore('documents', {
  state: () => ({
    documents: [] as DocumentRecord[]
  }),

  getters: {
    sortedDocuments: (state) =>
      [...state.documents].sort((a, b) => b.createdAt - a.createdAt),

    byCategory: (state) => (category: string) =>
      state.documents.filter(d => d.category === category),

    byId: (state) => (id: number) =>
      state.documents.find(d => d.id === id)
  },

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