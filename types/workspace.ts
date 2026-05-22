
export type WorkspaceRole = 'admin' | 'member'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Workspace {
  id: string
  name: string
  slug: string
  owner_id: string
  settings: Record<string, unknown>
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  invited_by: string | null
  joined_at: string
  email?: string
}

export interface DocumentApproval {
  id: string
  document_id: string
  workspace_id: string
  status: ApprovalStatus
  submitted_by: string
  reviewed_by: string | null
  notes: string | null
  updated_at: string
}

export interface CreateWorkspacePayload {
  name: string
}

export interface InviteMemberPayload {
  email: string
  role: WorkspaceRole
  workspace_id: string
}

export interface ApprovalActionPayload {
  approval_id: string
  status: 'approved' | 'rejected'
  notes?: string
}
