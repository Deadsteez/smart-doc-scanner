// useSemanticEngine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central composable that:
//  1. Manages the embedding worker lifecycle
//  2. Embeds documents when saved (async, non-blocking)
//  3. Embeds search queries on demand
//  4. Exposes semantic search + query parsing to the UI
//
import { ref, shallowRef } from 'vue'
import { db } from '~/services/db'
import type { DocumentRecord } from '~/services/db'
import { semanticSearch, hybridSearch, findSemanticDuplicates } from '~/services/semanticSearch'
import type { SemanticSearchResult } from '~/services/semanticSearch'
import { parseNlQuery, explainQuery } from '~/composables/useNlpQuery'
import type { ParsedQuery } from '~/composables/useNlpQuery'
import { inferExpenseCategory, extractSemanticTags } from '~/services/vendorIntelligence'

// ─── Worker singleton (module-level so it survives route changes) ─────────────
let worker: Worker | null = null
let workerReady           = false
const workerReadyCallbacks: Array<() => void> = []
const pendingEmbeddings   = new Map<string, { resolve: (v: number[]) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker

  // Vite ?worker import — processed at build time
  worker = new Worker(
    new URL('~/workers/embeddingWorker.js', import.meta.url),
    { type: 'module' }
  )

  worker.onmessage = (e) => {
    const msg = e.data

    if (msg.type === 'progress' && msg.stage === 'ready') {
      workerReady = true
      workerReadyCallbacks.forEach(cb => cb())
      workerReadyCallbacks.length = 0
      return
    }

    if (msg.type === 'result' && msg.id) {
      const p = pendingEmbeddings.get(msg.id)
      if (p) { p.resolve(msg.embedding); pendingEmbeddings.delete(msg.id) }
      return
    }

    if (msg.type === 'error' && msg.id) {
      const p = pendingEmbeddings.get(msg.id)
      if (p) { p.reject(new Error(msg.error)); pendingEmbeddings.delete(msg.id) }
    }
  }

  worker.onerror = (err) => {
    console.error('[SemanticEngine] Worker error:', err)
  }

  return worker
}

// ─── Embed a single text string ───────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const w  = getWorker()
  const id = `embed_${Date.now()}_${Math.random().toString(36).slice(2)}`

  return new Promise<number[]>((resolve, reject) => {
    pendingEmbeddings.set(id, { resolve, reject })

    const send = () => w.postMessage({ text, id })

    if (workerReady) {
      send()
    } else {
      workerReadyCallbacks.push(send)
    }

    // Timeout after 30s
    setTimeout(() => {
      if (pendingEmbeddings.has(id)) {
        pendingEmbeddings.delete(id)
        reject(new Error('Embedding timeout'))
      }
    }, 30_000)
  })
}

// ─── Semantic enrichment on save ──────────────────────────────────────────────
// Call this after a document is saved to IndexedDB.
// Runs async — does NOT block the save flow.

export async function enrichDocumentAsync(
  localId: number,
  cleanedText: string,
  vendor?: string
): Promise<void> {
  try {
    // 1. Expense category (fast, sync)
    const expenseCategory = inferExpenseCategory(cleanedText, vendor)

    // 2. Semantic tags (fast, sync)
    const semanticTags    = extractSemanticTags(cleanedText)

    // 3. Embedding (async — MiniLM inference)
    const embedding       = await embedText(cleanedText)

    // 4. Patch the record in IndexedDB
    await db.documents.update(localId, { embedding, expenseCategory, semanticTags })

    console.log(`[SemanticEngine] Enriched doc #${localId} → ${expenseCategory}, ${semanticTags.join(', ') || 'no tags'}`)

  } catch (err) {
    // Non-fatal — document still works without embedding
    console.warn('[SemanticEngine] Enrichment failed (non-fatal):', err)
  }
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useSemanticEngine() {
  const isEmbedderReady = ref(false)
  const isSearching     = ref(false)
  const parsedQuery     = shallowRef<ParsedQuery | null>(null)
  const queryExplanation = ref('')

  // Preload embedding worker
  if (import.meta.client) {
    const w = getWorker()
    if (workerReady) {
      isEmbedderReady.value = true
    } else {
      workerReadyCallbacks.push(() => { isEmbedderReady.value = true })
    }
  }

  // ── Main semantic search ────────────────────────────────────────────────────
  async function search(
    rawQuery: string,
    allDocs: DocumentRecord[],
    topK = 50
  ): Promise<SemanticSearchResult[]> {
    if (!rawQuery.trim()) return allDocs.map((doc, i) => ({ doc, score: 1, rank: i + 1 }))

    isSearching.value = true

    try {
      // Parse natural language → structured filters
      const parsed = parseNlQuery(rawQuery)
      parsedQuery.value    = parsed
      queryExplanation.value = explainQuery(parsed)

      // Apply date filter (docs are sorted by createdAt, dates are ISO strings)
      let dateDocs = allDocs
      if (parsed.dateFrom || parsed.dateTo) {
        dateDocs = allDocs.filter(doc => {
          const d = new Date(doc.createdAt).toISOString().slice(0, 10)
          if (parsed.dateFrom && d < parsed.dateFrom) return false
          if (parsed.dateTo   && d > parsed.dateTo)   return false
          return true
        })
      }

      // Embed the semantic query text
      const queryEmbedding = await embedText(parsed.semanticQuery)

      // Hybrid search: semantic + structured filters
      return hybridSearch(queryEmbedding, dateDocs, {
        category:        parsed.category,
        expenseCategory: parsed.expenseCategory,
        minAmount:       parsed.minAmount,
        maxAmount:       parsed.maxAmount,
        semanticTags:    parsed.semanticTags,
      }, topK)

    } catch (err) {
      console.error('[SemanticEngine] Search failed:', err)
      // Graceful fallback: return all docs unranked
      return allDocs.map((doc, i) => ({ doc, score: 0, rank: i + 1 }))
    } finally {
      isSearching.value = false
    }
  }

  // ── Duplicate detection ─────────────────────────────────────────────────────
  async function findDuplicates(
    text: string,
    allDocs: DocumentRecord[]
  ): Promise<DocumentRecord[]> {
    try {
      const embedding = await embedText(text)
      return findSemanticDuplicates(embedding, allDocs)
    } catch {
      return []
    }
  }

  return {
    isEmbedderReady,
    isSearching,
    parsedQuery,
    queryExplanation,
    search,
    findDuplicates,
    embedText,
  }
}
