import type { DocumentRecord } from '~/services/db'

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += (a[i]! * b[i]!)
  return dot   // already normalised, so result is in [-1, 1]
}

export interface SemanticSearchResult {
  doc:        DocumentRecord
  score:      number   // cosine similarity [0, 1]
  rank:       number
}

/**
 * Rank documents by semantic similarity to a query embedding.
 * Documents without stored embeddings are included at the bottom with score=0
 * so they don't disappear from results entirely.
 */
export function semanticSearch(
  queryEmbedding: number[],
  docs: DocumentRecord[],
  topK = 50,
  minScore = 0.10
): SemanticSearchResult[] {
  const scored = docs.map(doc => ({
    doc,
    score: doc.embedding?.length
      ? cosineSimilarity(queryEmbedding, doc.embedding)
      : -1,
    rank: 0,
  }))

  scored.sort((a, b) => {
    if (a.score >= 0 && b.score >= 0) return b.score - a.score
    if (a.score < 0 && b.score >= 0) return 1
    if (a.score >= 0 && b.score < 0) return -1
    return b.doc.createdAt - a.doc.createdAt
  })

  return scored
    .filter(r => r.score < 0 || r.score >= minScore)
    .slice(0, topK)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

/**
 * Find documents that are semantically similar to a given embedding.
 * Uses a high threshold (>0.92) to detect likely duplicates.
 */
export function findSemanticDuplicates(
  embedding: number[],
  docs: DocumentRecord[],
  threshold = 0.92
): DocumentRecord[] {
  return docs.filter(doc =>
    doc.embedding?.length &&
    cosineSimilarity(embedding, doc.embedding) >= threshold
  )
}

/**
 * Combine keyword filter with semantic ranking.
 * Keyword filter is applied first (hard constraint), then results are
 * ranked by semantic similarity.
 */
export function hybridSearch(
  queryEmbedding: number[],
  docs: DocumentRecord[],
  filters: {
    category?:        string
    expenseCategory?: string
    minAmount?:       number
    maxAmount?:       number
    vendor?:          string
    dateFrom?:        string
    dateTo?:          string
    semanticTags?:    string[]
  },
  topK = 30
): SemanticSearchResult[] {
  let filtered = docs

  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(d => d.category?.type === filters.category)
  }
  if (filters.expenseCategory && filters.expenseCategory !== 'all') {
    filtered = filtered.filter(d => d.expenseCategory === filters.expenseCategory)
  }
  if (filters.vendor) {
    const v = filters.vendor.toLowerCase()
    filtered = filtered.filter(d =>
      (d.extracted?.vendor ?? '').toLowerCase().includes(v)
    )
  }
  if (filters.minAmount !== undefined) {
    filtered = filtered.filter(d => {
      const a = parseFloat((d.extracted?.total ?? '0').replace(/[,\s]/g, ''))
      return !isNaN(a) && a >= filters.minAmount!
    })
  }
  if (filters.maxAmount !== undefined) {
    filtered = filtered.filter(d => {
      const a = parseFloat((d.extracted?.total ?? '0').replace(/[,\s]/g, ''))
      return !isNaN(a) && a <= filters.maxAmount!
    })
  }
  if (filters.semanticTags?.length) {
    filtered = filtered.filter(d =>
      filters.semanticTags!.some(tag => d.semanticTags?.includes(tag))
    )
  }

  return semanticSearch(queryEmbedding, filtered, topK)
}
