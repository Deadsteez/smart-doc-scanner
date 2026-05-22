<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspaceStore } from '~/stores/workspaceStore'
import { usePermissions } from '~/composables/usePermissions'
import type { WorkspaceMember } from '~/types/workspace'

const workspaceStore = useWorkspaceStore()
const { isAdmin } = usePermissions()

const removingId = ref<string | null>(null)

async function handleRemove(member: WorkspaceMember) {
  if (!confirm(`Remove ${member.email ?? 'this member'} from the workspace?`)) return
  removingId.value = member.id
  await workspaceStore.removeMember(member.id)
  removingId.value = null
}

const roleColors = {
  admin: 'bg-accent-primary/10 text-accent-primary',
  member: 'bg-bg-tertiary text-text-secondary',
}
</script>

<template>
  <div id="workspace-member-list" class="space-y-2">
    <div v-if="workspaceStore.members.length === 0" class="text-center py-8 text-text-muted text-sm">
      No members yet.
    </div>

    <div v-for="member in workspaceStore.members" :key="member.id"
      class="flex items-center justify-between gap-3 px-4 py-3 bg-bg-secondary rounded-xl border border-slate-1/20 hover:border-slate-1/40 transition-all">
      <!-- Avatar + info -->
      <div class="flex items-center gap-3 min-w-0">
        <div
          class="w-9 h-9 rounded-full bg-accent-primary/15 flex items-center justify-center text-accent-primary font-bold text-sm select-none flex-shrink-0">
          {{ (member.email ?? '?').slice(0, 2).toUpperCase() }}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-medium text-text-primary truncate">{{ member.email ?? member.user_id.slice(0, 12) + '…'
            }}</p>
          <p class="text-xs text-text-muted mt-0.5">Joined {{ new Date(member.joined_at).toLocaleDateString() }}</p>
        </div>
      </div>

      <!-- Role badge + remove button -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-xs font-semibold px-2.5 py-1 rounded-lg uppercase tracking-wide"
          :class="roleColors[member.role]">
          {{ member.role }}
        </span>

        <button v-if="isAdmin && member.user_id !== workspaceStore.currentUserId" @click="handleRemove(member)"
          :disabled="removingId === member.id"
          class="p-1.5 rounded-lg text-error/50 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40"
          :title="`Remove ${member.email ?? 'member'}`">
          <svg v-if="removingId === member.id" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12a8 8 0 018-8" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
