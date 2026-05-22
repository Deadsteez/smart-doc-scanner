import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getSupabase } from '~/services/supabaseClient'
import type {
  Workspace,
  WorkspaceMember,
  DocumentApproval,
  CreateWorkspacePayload,
  ApprovalActionPayload,
  ApprovalStatus,
} from '~/types/workspace'

export const useWorkspaceStore = defineStore('workspace', () => {
  const supabase = getSupabase()

  // ── State ──────────────────────────────────────────────────
  const workspaces = ref<Workspace[]>([])
  const currentWorkspace = ref<Workspace | null>(null)
  const members = ref<WorkspaceMember[]>([])
  const approvals = ref<DocumentApproval[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ─────────────────────────────────────────────────
  const currentUserId = computed<string | null>(() => {
    // Resolved reactively — components should call loadCurrentUser() on mount
    return _currentUserId.value
  })
  const _currentUserId = ref<string | null>(null)

  const currentMember = computed(() =>
    members.value.find(m => m.user_id === _currentUserId.value) ?? null
  )

  const pendingApprovals = computed(() =>
    approvals.value.filter(a => a.status === 'pending')
  )

  // ── Helpers ─────────────────────────────────────────────────
  async function loadCurrentUser() {
    const { data } = await supabase.auth.getUser()
    _currentUserId.value = data.user?.id ?? null
  }

  function slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      + '-' + Math.random().toString(36).slice(2, 7)
  }

  // ── Workspace CRUD ──────────────────────────────────────────
  async function fetchWorkspaces() {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })

      if (err) throw err
      workspaces.value = data ?? []

      // Auto-select first workspace if none selected
      if (!currentWorkspace.value && workspaces.value.length > 0) {
      
        await selectWorkspace(workspaces.value[0]!.id)
      }
    } catch (err: any) {
      console.error('[WorkspaceStore] fetchWorkspaces:', err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function selectWorkspace(workspaceId: string) {
    const ws = workspaces.value.find(w => w.id === workspaceId) ?? null
    currentWorkspace.value = ws
    if (ws) {
      await Promise.all([fetchMembers(workspaceId), fetchApprovals(workspaceId)])
    }
  }

  async function createWorkspace(payload: CreateWorkspacePayload): Promise<Workspace | null> {
    loading.value = true
    error.value = null
    try {
      await loadCurrentUser()
      if (!_currentUserId.value) throw new Error('Not authenticated')

      const slug = slugify(payload.name)

      const { data, error: err } = await supabase
        .from('workspaces')
        .insert({
          name: payload.name,
          slug,
          owner_id: _currentUserId.value,
          settings: {},
        })
        .select()
        .single()

      if (err) throw err

      // Auto-add creator as admin member
      await supabase.from('workspace_members').insert({
        workspace_id: data.id,
        user_id: _currentUserId.value,
        role: 'admin',
        invited_by: null,
      })

      workspaces.value.unshift(data)
      await selectWorkspace(data.id)
      return data
    } catch (err: any) {
      console.error('[WorkspaceStore] createWorkspace:', err)
      error.value = err.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateWorkspaceName(name: string) {
    if (!currentWorkspace.value) return
    const { error: err } = await supabase
      .from('workspaces')
      .update({ name })
      .eq('id', currentWorkspace.value.id)

    if (err) { error.value = err.message; return }
    currentWorkspace.value.name = name
   const wsId = currentWorkspace.value?.id
const idx = workspaces.value.findIndex(w => w.id === wsId)
if (idx !== -1) {
  const ws = workspaces.value[idx]
  if (ws) ws.name = name
}
  }
  async function deleteWorkspace(workspaceId: string): Promise<boolean> {
    loading.value = true
    try {
      const { error: err } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId)

      if (err) throw err

      workspaces.value = workspaces.value.filter(w => w.id !== workspaceId)
      if (currentWorkspace.value?.id === workspaceId) {
        currentWorkspace.value = null
        if (workspaces.value.length > 0) {
          await selectWorkspace(workspaces.value[0]!.id)
        }
      }
      return true
    } catch (err: any) {
      console.error('[WorkspaceStore] deleteWorkspace:', err)
      error.value = err.message
      return false
    } finally {
      loading.value = false
    }
  }

  // ── Members ─────────────────────────────────────────────────
  async function fetchMembers(workspaceId: string) {
    loading.value = true
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) throw new Error('Not authenticated')

      const membersData = await $fetch<WorkspaceMember[]>(`/api/workspace/${workspaceId}/members`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      
      members.value = membersData
    } catch (err: any) {
      console.error('[WorkspaceStore] fetchMembers:', err)
    } finally {
      loading.value = false
    }
  }

  async function removeMember(memberId: string) {
    const { error: err } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)

    if (err) { error.value = err.message; return }
    members.value = members.value.filter(m => m.id !== memberId)
  }

  // ── Approvals ────────────────────────────────────────────────
  async function fetchApprovals(workspaceId: string) {
    const { data, error: err } = await supabase
      .from('document_approvals')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })

    if (err) { console.error('[WorkspaceStore] fetchApprovals:', err); return }
    approvals.value = data ?? []
  }

  async function submitForApproval(documentId: string): Promise<boolean> {
    if (!currentWorkspace.value) return false
    await loadCurrentUser()
    if (!_currentUserId.value) return false

    const { data, error: err } = await supabase
      .from('document_approvals')
      .insert({
        document_id: documentId,
        workspace_id: currentWorkspace.value.id,
        status: 'pending',
        submitted_by: _currentUserId.value,
      })
      .select()
      .single()

    if (err) { error.value = err.message; return false }
    approvals.value.unshift(data)
    return true
  }

  async function reviewApproval(payload: ApprovalActionPayload): Promise<boolean> {
    await loadCurrentUser()
    if (!_currentUserId.value) return false

    const { error: err } = await supabase
      .from('document_approvals')
      .update({
        status: payload.status,
        reviewed_by: _currentUserId.value,
        notes: payload.notes ?? null,
      })
      .eq('id', payload.approval_id)

    if (err) { error.value = err.message; return false }

    const idx = approvals.value.findIndex(a => a.id === payload.approval_id)
    if (idx !== -1) {
  const approval = approvals.value[idx]
  if (approval) {
    approval.status = payload.status
    approval.reviewed_by = _currentUserId.value
    approval.notes = payload.notes ?? null
  }
}
    return true
  }

  async function resubmitApproval(approvalId: string): Promise<boolean> {
    const { error: err } = await supabase
      .from('document_approvals')
      .update({ status: 'pending' as ApprovalStatus, reviewed_by: null, notes: null })
      .eq('id', approvalId)

    if (err) { error.value = err.message; return false }

    const idx = approvals.value.findIndex(a => a.id === approvalId)
  if (idx !== -1) {
  const approval = approvals.value[idx]
  if (approval) {
    approval.status = 'pending'
    approval.reviewed_by = null
    approval.notes = null
  }
}
    return true
  }

  function getApprovalForDocument(documentId: string): DocumentApproval | null {
    return approvals.value.find(a => a.document_id === documentId) ?? null
  }

  return {
    // state
    workspaces,
    currentWorkspace,
    members,
    approvals,
    loading,
    error,
    // getters
    currentUserId,
    currentMember,
    pendingApprovals,
    // actions
    loadCurrentUser,
    fetchWorkspaces,
    selectWorkspace,
    createWorkspace,
    updateWorkspaceName,
    deleteWorkspace,
    fetchMembers,
    removeMember,
    fetchApprovals,
    submitForApproval,
    reviewApproval,
    resubmitApproval,
    getApprovalForDocument,
  }
})
