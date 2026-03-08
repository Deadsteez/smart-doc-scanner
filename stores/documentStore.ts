import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '~/services/db'
import type { DocumentRecord } from '~/services/db'
import { getSupabase } from '~/services/supabaseClient'

export const useDocumentStore = defineStore('documents', () => {
  const documents = ref<DocumentRecord[]>([])
  const syncing = ref(false)
  const syncError = ref<string | null>(null)

  // ─── Helpers ─────────────────────────────────────────────────

  // Single helper — supabase.auth.session() was removed in v2.
  // Always use getSession() which works for both SSR and client.
  async function getCurrentUserId(): Promise<string | null> {
    try {
      const supabase = getSupabase()
      const { data } = await supabase.auth.getSession()
      return data.session?.user?.id ?? null
    } catch {
      return null
    }
  }

  // ─── Reload local state ──────────────────────────────────────

  async function reloadLocal() {
    documents.value = await db.documents
      .orderBy('createdAt')
      .reverse()
      .toArray()
  }

  // ─── Load ────────────────────────────────────────────────────

  async function loadAll() {
    // 1. Show local data immediately
    await reloadLocal()

    // 2. Pull any cloud records not yet in local DB
    await pullFromSupabase()
  }

  // ─── Pull from Supabase ──────────────────────────────────────

  async function pullFromSupabase() {
    const userId = await getCurrentUserId()
    if (!userId) return

    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[Store] Supabase pull error:', error.message)
        return
      }

      if (!data?.length) return

      // Upsert cloud records into Dexie — skip if already present by supabaseId
      for (const row of data) {
        const exists = await db.documents
          .where('supabaseId')
          .equals(row.id)
          .first()

        if (!exists) {
          await db.documents.add({
            supabaseId: row.id,
            userId: row.user_id,
            createdAt: row.created_at,
            image: row.image,
            ocrText: row.ocr_text ?? '',
            cleanedText: row.cleaned_text ?? '',
            extracted: {
              vendor: row.vendor,
              date: row.date,
              total: row.total,
              receiptNumber: row.receipt_number,
            },
            category: {
              type: row.category ?? 'other',
              confidence: row.category_confidence ?? 0,
              scores: { invoice: 0, receipt: 0 },
            },
            synced: true,
          })
        }
      }

      await reloadLocal()
    } catch (err) {
      console.error('[Store] Pull failed:', err)
    }
  }

  // ─── Add ─────────────────────────────────────────────────────

  async function add(doc: Omit<DocumentRecord, 'id' | 'supabaseId'>) {
    const userId = await getCurrentUserId()

    // Save locally first — UI updates instantly, works offline
    const localId = await db.documents.add({
      ...doc,
      userId: userId ?? undefined,
      synced: false,
    })

    await reloadLocal()

    // Push to Supabase in background if authenticated
    if (userId) {
      await pushToSupabase(localId, userId)
    }
  }

  // ─── Push to Supabase ────────────────────────────────────────

  async function pushToSupabase(localId: number, userId: string) {
    syncing.value = true
    syncError.value = null

    try {
      const record = await db.documents.get(localId)
      if (!record) return

      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          created_at: record.createdAt,
          image: record.image,
          ocr_text: record.ocrText,
          cleaned_text: record.cleanedText,
          vendor: record.extracted?.vendor ?? null,
          date: record.extracted?.date ?? null,
          total: record.extracted?.total ?? null,
          receipt_number: record.extracted?.receiptNumber ?? null,
          category: record.category?.type ?? 'other',
          category_confidence: record.category?.confidence ?? 0,
          synced: true,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[Store] Supabase push error:', error.message)
        syncError.value = error.message
        return
      }

      // Mark record as synced locally with its Supabase UUID
      await db.documents.update(localId, {
        synced: true,
        supabaseId: data.id,
      })

      await reloadLocal()
    } catch (err: any) {
      console.error('[Store] Push failed:', err)
      syncError.value = err.message
    } finally {
      syncing.value = false
    }
  }

  // ─── Sync pending (call on app load for offline resilience) ──

  async function syncPending() {
    const userId = await getCurrentUserId()
    if (!userId) return

    const pending = await db.documents
      .filter(d => d.synced === false)
      .toArray()

    for (const record of pending) {
      if (record.id) {
        await pushToSupabase(record.id, userId)
      }
    }
  }

  // ─── Remove ──────────────────────────────────────────────────

  async function remove(id: number) {
    const record = await db.documents.get(id)

    if (record?.supabaseId) {
      try {
        const supabase = getSupabase()
        await supabase
          .from('documents')
          .delete()
          .eq('id', record.supabaseId)
      } catch (err) {
        console.error('[Store] Supabase delete error:', err)
      }
    }

    await db.documents.delete(id)
    await reloadLocal()
  }

  // ─── Getters ─────────────────────────────────────────────────

  const sortedDocuments = computed(() =>
    [...documents.value].sort((a, b) => b.createdAt - a.createdAt)
  )

  const byCategory = computed(() => (category: string) =>
    documents.value.filter(d => d.category?.type === category)
  )

  return {
    documents,
    syncing,
    syncError,
    sortedDocuments,
    byCategory,
    loadAll,
    add,
    remove,
    syncPending,
  }
})