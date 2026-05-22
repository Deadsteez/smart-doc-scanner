import { getSupabase } from '~/services/supabaseClient'

export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth()
  const documentStore = useDocumentStore()
  const workspaceStore = useWorkspaceStore()
  const notificationStore = useNotificationStore()

  try {
    await initAuth()
  } catch (err) {
    console.error('[auth.client] Failed to initialize auth:', err)
  }

  try {
    await documentStore.syncPending()
  } catch (err) {
    console.error('[auth.client] Failed to sync pending documents:', err)
  }

  try {
    await workspaceStore.loadCurrentUser()
    await workspaceStore.fetchWorkspaces()
  } catch (err) {
    console.error('[auth.client] Failed to load workspaces:', err)
  }

  try {
    notificationStore.init()
  } catch (err) {
    console.error('[auth.client] Failed to initialize notifications:', err)
  }

  try {
    const currentWorkspaceId = workspaceStore.currentWorkspace?.id
    if (currentWorkspaceId) {
      const supabase = getSupabase()
      supabase
        .channel(`approvals:${currentWorkspaceId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'document_approvals',
            filter: `workspace_id=eq.${currentWorkspaceId}`,
          },
          (payload) => {
            const updated = payload.new as any
            const statusLabels: Record<string, string> = {
              approved: '✅ Approved',
              rejected: '❌ Rejected',
              pending: '🕐 Resubmitted',
            }
            notificationStore.push({
              type: 'approval',
              title: statusLabels[updated.status] ?? 'Document Updated',
              message: `Document approval status changed to ${updated.status}.`,
              status: updated.status,
              document_id: updated.document_id,
              workspace_id: updated.workspace_id,
            })
            workspaceStore.fetchApprovals(currentWorkspaceId)
          }
        )
        .subscribe()
    }
  } catch (err) {
    console.error('[auth.client] Failed to subscribe to realtime approvals:', err)
  }
})