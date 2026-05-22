import { computed } from 'vue'
import { useWorkspaceStore } from '~/stores/workspaceStore'

/**
 * usePermissions — single source of truth for role checks.
 *
 * The two-role model (admin | member) only needs one boolean.
 * Replace every role check in templates and server routes with `isAdmin`.
 *
 * Usage:
 *   const { isAdmin } = usePermissions()
 *   v-if="isAdmin"  ←  show Approve / Reject buttons, invite form, etc.
 */
export const usePermissions = () => {
  const workspaceStore = useWorkspaceStore()

  const isOwner = computed<boolean>(() => {
    return (
      !!workspaceStore.currentWorkspace &&
      workspaceStore.currentWorkspace.owner_id === workspaceStore.currentUserId
    )
  })

  const isAdmin = computed<boolean>(() => {
    return isOwner.value || workspaceStore.currentMember?.role === 'admin'
  })

  /**
   * Returns true if the current user submitted the given approval record.
   * Used to show the "Resubmit" button on rejected documents.
   */
  const isSubmitter = (submittedById: string): boolean => {
    return workspaceStore.currentUserId === submittedById
  }

  return { isAdmin, isOwner, isSubmitter }
}
