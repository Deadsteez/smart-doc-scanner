import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '~/services/db'
import type { DocumentRecord } from '~/services/db'
import { getSupabase } from '~/services/supabaseClient'
import { useWorkspaceStore } from '~/stores/workspaceStore'

export const useDocumentStore = defineStore('documents', () => {
  const documents = ref<DocumentRecord[]>([])
  const syncing   = ref(false)
  const syncError = ref<string | null>(null)
  const lastId    = ref<number | null>(null)

  async function getCurrentUserId(): Promise<string | null> {
    try {
      const supabase = getSupabase()
      const { data } = await supabase.auth.getSession()
      return data.session?.user?.id ?? null
    } catch {
      return null
    }
  }

  async function reloadLocal() {
    documents.value = await db.documents.toArray()
  }

  async function loadAll() {
    const userId = await getCurrentUserId()
    await reloadLocal()
    if (userId) await pullFromSupabase(userId)
  }

  async function pullFromSupabase(userId: string) {
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[Store] Pull error:', error.message)
        return
      }
      if (!data?.length) return

      for (const row of data) {
        const exists = await db.documents
          .where('supabaseId').equals(row.id).first()

        if (!exists) {
          await db.documents.add({
            supabaseId:   row.id,
            userId:       row.user_id,
            workspaceId:  row.workspace_id ?? undefined,
            createdAt:    row.created_at,
            image:        row.image,
            ocrText:      row.ocr_text ?? '',
            cleanedText:  row.cleaned_text ?? '',
            extracted: {
              vendor:        row.vendor,
              date:          row.date,
              total:         row.total,
              tax:           row.tax,
              receiptNumber: row.receipt_number,
              paymentMethod: row.payment_method,
              items:         row.items ?? [],
            },
            category: {
              type:       row.category ?? 'other',
              nlpLabel:   row.nlp_label,
              confidence: row.category_confidence ?? 0,
              scores:     row.category_scores ?? { invoice: 0, receipt: 0, bank_statement: 0, payment_slip: 0, utility_bill: 0, tax_document: 0, contract: 0, other: 0 },
            },
            synced: true,
          })
        } else if (!exists.synced) {
          // Local unsynced record takes priority — leave it for syncPending
        } else {
          await db.documents.update(exists.id!, {
            image:       row.image,
            ocrText:     row.ocr_text ?? '',
            cleanedText: row.cleaned_text ?? '',
            extracted: {
              vendor:        row.vendor,
              date:          row.date,
              total:         row.total,
              tax:           row.tax,
              receiptNumber: row.receipt_number,
              paymentMethod: row.payment_method,
              items:         row.items ?? [],
            },
            category: {
              type:       row.category ?? 'other',
              nlpLabel:   row.nlp_label,
              confidence: row.category_confidence ?? 0,
              scores:     row.category_scores ?? { invoice: 0, receipt: 0, bank_statement: 0, payment_slip: 0, utility_bill: 0, tax_document: 0, contract: 0, other: 0 },
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

  async function add(doc: Omit<DocumentRecord, 'id' | 'supabaseId' | 'workspaceId'>) {
    const userId = await getCurrentUserId()
    const workspaceStore = useWorkspaceStore()
    const activeWorkspaceId = workspaceStore.currentWorkspace?.id

    const localId = await db.documents.add({
      ...doc,
      userId:      userId ?? undefined,
      workspaceId: activeWorkspaceId ?? undefined,
      synced:      false,
    })

    lastId.value = localId

    await reloadLocal()

    if (userId) {
      await pushToSupabase(localId, userId)
    }

    return localId
  }

  async function update(id: number, patch: Partial<DocumentRecord>) {
    await db.documents.update(id, { ...patch, synced: false })
    await reloadLocal()

    const userId = await getCurrentUserId()
    if (userId) await pushToSupabase(id, userId)
  }

  async function pushToSupabase(localId: number, userId: string) {
    syncing.value   = true
    syncError.value = null

    try {
      const record = await db.documents.get(localId)
      if (!record) return

      const supabase = getSupabase()

      let imageUrl = record.image
      if (record.image?.startsWith('data:')) {
        const blob = await (await fetch(record.image)).blob()
        const ext  = blob.type.split('/')[1] ?? 'jpg'
        const path = `${userId}/${localId}.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('document-images')
          .upload(path, blob, { upsert: true, contentType: blob.type })

        if (uploadError) {
          console.error('[Store] Image upload error:', uploadError.message)
          syncError.value = uploadError.message
          return
        }

        const { data: urlData } = supabase.storage
          .from('document-images')
          .getPublicUrl(uploadData.path)
        imageUrl = urlData.publicUrl
      }

      const payload = {
        user_id:             userId,
        workspace_id:        record.workspaceId ?? null,
        created_at:          record.createdAt,
        image:               imageUrl,
        ocr_text:            record.ocrText,
        cleaned_text:        record.cleanedText,
        vendor:              record.extracted?.vendor         ?? null,
        date:                record.extracted?.date           ?? null,
        total:               record.extracted?.total          ?? null,
        receipt_number:      record.extracted?.receiptNumber  ?? null,
        tax:                 record.extracted?.tax            ?? null,
        payment_method:      record.extracted?.paymentMethod  ?? null,
        items:               record.extracted?.items          ?? null,
        category:            record.category?.type            ?? 'other',
        nlp_label:           record.category?.nlpLabel        ?? null,
        category_confidence: record.category?.confidence      ?? 0,
        category_scores:     record.category?.scores          ?? null,
      }

      let supabaseId = record.supabaseId

      if (supabaseId) {
        const { error } = await supabase
          .from('documents')
          .update(payload)
          .eq('id', supabaseId)

        if (error) {
          console.error('[Store] Update error:', error.message)
          syncError.value = error.message
          return
        }
      } else {
        const { data, error } = await supabase
          .from('documents')
          .insert(payload)
          .select('id')
          .single()

        if (error) {
          console.error('[Store] Push error:', error.message)
          syncError.value = error.message
          return
        }

        supabaseId = data.id
      }

      await db.documents.update(localId, {
        synced:     true,
        supabaseId,
        image:      imageUrl,
      })

      await reloadLocal()
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        console.warn('[Store] Push skipped — network unavailable, will retry')
        return
      }
      console.error('[Store] Push failed:', err)
      syncError.value = err.message
    } finally {
      syncing.value = false
    }
  }

  async function syncPending() {
    const userId = await getCurrentUserId()
    if (!userId) return

    const pending = await db.documents
      .filter(d => d.synced === false)
      .toArray()

    for (const record of pending) {
      try {
        if (record.id) await pushToSupabase(record.id, userId)
      } catch (err) {
        console.error('[Store] Sync failed for record:', record.id, err)
      }
    }
  }

  async function remove(id: number) {
    const record = await db.documents.get(id)

    if (record?.supabaseId) {
      try {
        const supabase = getSupabase()
        const { error } = await supabase
          .from('documents')
          .delete()
          .eq('id', record.supabaseId)

        if (error) {
          console.error('[Store] Remote delete failed:', error.message)
          return
        }

        if (record.image && !record.image.startsWith('data:')) {
          const path = record.image.split('/document-images/')[1]
          if (path) {
            const { error: storageError } = await supabase.storage
              .from('document-images')
              .remove([path])
            if (storageError) {
              console.warn('[Store] Image delete failed:', storageError.message)
            }
          }
        }
      } catch (err) {
        console.error('[Store] Delete error:', err)
      }
    }

    await db.documents.delete(id)
    await reloadLocal()
  }

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
    lastId,
    sortedDocuments,
    byCategory,
    loadAll,
    add,
    update,
    remove,
    syncPending,
  }
})