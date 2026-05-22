<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '~/stores/workspaceStore'
import ApprovalStatusBadge from '~/components/workspace/ApprovalStatusBadge.vue'

const workspaceStore = useWorkspaceStore()

const pendingApprovals = computed(() => workspaceStore.pendingApprovals)

function getSubmitterEmail(userId: string) {
  return workspaceStore.members.find(m => m.user_id === userId)?.email ?? 'Unknown User'
}

const emit = defineEmits<{
  (e: 'select', documentId: string): void
}>()
</script>

<template>
  <div id="approval-queue" class="space-y-3">
    <div v-if="pendingApprovals.length === 0" class="text-center py-12 text-text-muted">
      <svg class="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
      </svg>
      <p class="text-sm font-medium">No documents awaiting approval</p>
      <p class="text-xs text-text-muted/60 mt-1">All caught up! 🎉</p>
    </div>

    <div
      v-for="approval in pendingApprovals"
      :key="approval.id"
      class="flex items-center justify-between gap-4 bg-bg-secondary rounded-xl border border-warning/20 px-5 py-4 hover:border-warning/40 hover:shadow-[0_2px_12px_rgba(245,158,11,0.1)] transition-all cursor-pointer"
      @click="emit('select', approval.document_id)"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-4.5 h-4.5 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div class="min-w-0">
          <p class="text-sm font-medium text-text-primary truncate">Document #{{ approval.document_id.slice(0, 8) }}</p>
          <p class="text-xs text-text-muted mt-0.5">
            Submitted by <span class="font-medium text-text-secondary">{{ getSubmitterEmail(approval.submitted_by) }}</span> on {{ new Date(approval.updated_at).toLocaleDateString() }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <ApprovalStatusBadge :status="approval.status" size="sm" />
        <svg class="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      </div>
    </div>
  </div>
</template>

