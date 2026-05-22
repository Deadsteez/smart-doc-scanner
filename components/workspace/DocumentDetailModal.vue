<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '~/stores/workspaceStore'
import { useDocumentStore } from '~/stores/documentStore'
import { usePermissions } from '~/composables/usePermissions'
import ApprovalStatusBadge from '~/components/workspace/ApprovalStatusBadge.vue'
import type { DocumentApproval } from '~/types/workspace'

const props = defineProps<{
  documentId: string
  documentImage?: string
  documentText?: string
  extractedFields?: {
    vendor?: string
    date?: string
    total?: string
    tax?: string
    receiptNumber?: string
    paymentMethod?: string
  }
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updated'): void
}>()

const workspaceStore = useWorkspaceStore()
const { isAdmin, isSubmitter } = usePermissions()

const approval = computed<DocumentApproval | null>(() =>
  workspaceStore.getApprovalForDocument(props.documentId)
)

const submitterEmail = computed(() => {
  if (!approval.value) return null
  const member = workspaceStore.members.find(m => m.user_id === approval.value!.submitted_by)
  return member?.email ?? 'Unknown User'
})

// Approval action state
const reviewNotes = ref('')
const actionLoading = ref(false)
const actionError = ref('')

async function handleApprove() {
  if (!approval.value) return
  actionLoading.value = true
  actionError.value = ''
  const ok = await workspaceStore.reviewApproval({
    approval_id: approval.value.id,
    status: 'approved',
    notes: reviewNotes.value || undefined,
  })
  actionLoading.value = false
  if (ok) { reviewNotes.value = ''; emit('updated') }
  else actionError.value = workspaceStore.error ?? 'Failed to approve.'
}

async function handleReject() {
  if (!approval.value) return
  actionLoading.value = true
  actionError.value = ''
  const ok = await workspaceStore.reviewApproval({
    approval_id: approval.value.id,
    status: 'rejected',
    notes: reviewNotes.value || undefined,
  })
  actionLoading.value = false
  if (ok) { reviewNotes.value = ''; emit('updated') }
  else actionError.value = workspaceStore.error ?? 'Failed to reject.'
}

async function handleResubmit() {
  if (!approval.value) return
  actionLoading.value = true
  actionError.value = ''
  const ok = await workspaceStore.resubmitApproval(approval.value.id)
  actionLoading.value = false
  if (ok) emit('updated')
  else actionError.value = workspaceStore.error ?? 'Failed to resubmit.'
}

async function handleSubmitForApproval() {
  actionLoading.value = true
  actionError.value = ''
  const ok = await workspaceStore.submitForApproval(props.documentId)
  actionLoading.value = false
  if (ok) emit('updated')
  else actionError.value = workspaceStore.error ?? 'Failed to submit.'
}

const documentStore = useDocumentStore()
const localDoc = computed(() => documentStore.documents.find(d => (d as any).supabaseId === props.documentId))

async function handleDeleteDocument() {
  if (!localDoc.value?.id) return
  if (confirm("Are you sure you want to permanently delete this document?")) {
    actionLoading.value = true
    await documentStore.remove(localDoc.value.id)
    emit('close')
  }
}
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        @click.self="emit('close')"
        id="document-detail-modal"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
        >
          <div class="w-full max-w-2xl bg-bg-elevated rounded-2xl border border-slate-1/40 shadow-elevated overflow-hidden flex flex-col max-h-[90vh]">

            <!-- Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-1/20">
              <div class="flex items-center gap-3">
                <h2 class="text-base font-semibold text-text-primary">Document Details</h2>
                <ApprovalStatusBadge v-if="approval" :status="approval.status" />
              </div>
              <button
                id="modal-close-btn"
                @click="emit('close')"
                class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary/40 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto p-6 space-y-5">

              <!-- Document preview -->
              <div v-if="documentImage" class="rounded-xl overflow-hidden border border-slate-1/20 bg-bg-primary max-h-56 flex items-center justify-center">
                <img :src="documentImage" class="object-contain max-h-56 w-full" alt="Document preview" />
              </div>

              <!-- Extracted fields grid -->
              <div v-if="extractedFields" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <template v-for="(val, key) in extractedFields" :key="key">
                  <div v-if="val" class="bg-bg-secondary rounded-xl px-4 py-3 border border-slate-1/20">
                    <p class="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-medium">{{ key }}</p>
                    <p class="text-sm text-text-primary font-medium truncate">{{ val }}</p>
                  </div>
                </template>
              </div>

              <!-- OCR text preview -->
              <div v-if="documentText" class="bg-bg-secondary rounded-xl p-4 border border-slate-1/20">
                <p class="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-medium">Extracted Text</p>
                <p class="text-xs text-text-secondary whitespace-pre-wrap line-clamp-6">{{ documentText }}</p>
              </div>

              <!-- Reviewer notes & Submitter Info -->
              <div v-if="approval" class="bg-bg-secondary rounded-xl p-4 border border-slate-1/20 space-y-4">
                <div>
                  <p class="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-medium">Submitted By</p>
                  <p class="text-sm text-text-primary flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-accent-primary/15 flex items-center justify-center text-accent-primary text-xs font-bold">
                      {{ submitterEmail?.slice(0, 2).toUpperCase() }}
                    </span>
                    {{ submitterEmail }}
                  </p>
                </div>
                
                <div v-if="approval.notes">
                  <p class="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-medium border-t border-slate-1/20 pt-3">Reviewer Notes</p>
                  <p class="text-sm text-text-secondary italic">{{ approval.notes }}</p>
                </div>
              </div>

              <!-- Error message -->
              <div v-if="actionError" class="bg-error/10 border border-error/20 rounded-xl px-4 py-3 text-sm text-error">
                {{ actionError }}
              </div>
            </div>

            <!-- Footer actions -->
            <div class="border-t border-slate-1/20 px-6 py-4 space-y-3">

              <!-- Admin: notes + approve/reject (only on pending) -->
              <template v-if="isAdmin && approval?.status === 'pending'">
                <textarea
                  v-model="reviewNotes"
                  placeholder="Add reviewer notes (optional)…"
                  rows="2"
                  class="w-full px-3 py-2 rounded-xl bg-bg-secondary border border-slate-1 text-text-primary placeholder-text-muted text-sm focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/20 focus:outline-none transition-all resize-none"
                />
                <div class="flex gap-3">
                  <button
                    id="approve-btn"
                    @click="handleApprove"
                    :disabled="actionLoading"
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success/15 text-success hover:bg-success/25 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    <svg v-if="actionLoading" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12a8 8 0 018-8"/></svg>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    Approve
                  </button>
                  <button
                    id="reject-btn"
                    @click="handleReject"
                    :disabled="actionLoading"
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-error/15 text-error hover:bg-error/25 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    Reject
                  </button>
                </div>
              </template>

              <!-- Submitter: resubmit on rejected -->
              <template v-else-if="approval && approval.status === 'rejected' && isSubmitter(approval.submitted_by)">
                <button
                  id="resubmit-btn"
                  @click="handleResubmit"
                  :disabled="actionLoading"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-warning/15 text-warning hover:bg-warning/25 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Resubmit for Approval
                </button>
              </template>

              <!-- No approval yet — submit button -->
              <template v-else-if="!approval && !isAdmin">
                <button
                  id="submit-approval-btn"
                  @click="handleSubmitForApproval"
                  :disabled="actionLoading"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  Submit for Approval
                </button>
              </template>

              <!-- Actions (Close / Delete) -->
              <div class="flex gap-3">
                <button
                  @click="emit('close')"
                  class="flex-1 px-4 py-2.5 text-sm bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80 rounded-xl transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  v-if="localDoc?.userId === workspaceStore.currentUserId"
                  @click="handleDeleteDocument"
                  :disabled="actionLoading"
                  class="px-4 py-2.5 text-sm bg-error/10 text-error hover:bg-error/20 rounded-xl transition-colors font-medium disabled:opacity-50"
                  title="Delete Document"
                >
                  Delete
                </button>
              </div>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

