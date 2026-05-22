import { computed } from 'vue'
import { useWorkspaceStore } from '~/stores/workspaceStore'

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

  
  const isSubmitter = (submittedById: string): boolean => {
    return workspaceStore.currentUserId === submittedById
  }

  return { isAdmin, isOwner, isSubmitter }
}