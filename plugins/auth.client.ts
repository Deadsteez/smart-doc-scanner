export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth()
  await initAuth()

  // Sync any pending documents that failed to upload previously
  const documentStore = useDocumentStore()
  await documentStore.syncPending()

  // ── Workspace: fetch workspaces for current user ──────────
  const workspaceStore = useWorkspaceStore()
  await workspaceStore.loadCurrentUser()
  await workspaceStore.fetchWorkspaces()

  // ── Notifications: hydrate from localStorage ───────────────
  const notificationStore = useNotificationStore()
  notificationStore.init()

  // ── Realtime: subscribe to document_approvals changes ──────
  const currentWorkspaceId = workspaceStore.currentWorkspace?.id
  if (currentWorkspaceId) {
    const { getSupabase } = await import('~/services/supabaseClient')
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

          // Reflect change in workspace store's local state
          workspaceStore.fetchApprovals(currentWorkspaceId)
        }
      )
      .subscribe()
  }
})