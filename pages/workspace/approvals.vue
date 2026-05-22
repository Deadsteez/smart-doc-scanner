<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useWorkspaceStore } from '~/stores/workspaceStore'
import { usePermissions } from '~/composables/usePermissions'
import ApprovalQueuePanel from '~/components/workspace/ApprovalQueuePanel.vue'
import DocumentDetailModal from '~/components/workspace/DocumentDetailModal.vue'
import { useDocumentStore } from '~/stores/documentStore'



const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()
const { isAdmin } = usePermissions()

const selectedDocId = ref<string | null>(null)
const showModal = ref(false)

onMounted(async () => {
  await documentStore.loadAll()
})

function openDocument(documentId: string) {
  selectedDocId.value = documentId
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  selectedDocId.value = null
}

const selectedDoc = computed(() =>
  documentStore.documents.find(d => (d as any).supabaseId === selectedDocId.value) ?? null
)
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto animate-fade-in">

    <!-- Header -->
    <div class="flex items-center gap-3 mb-8">
      <NuxtLink to="/workspace" class="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary/40 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </NuxtLink>
      <div>
        <h1 class="text-xl font-semibold text-text-primary">Approval Queue</h1>
        <p class="text-xs text-text-muted mt-0.5">
          {{ workspaceStore.pendingApprovals.length }} pending
        </p>
      </div>
    </div>

    <!-- Guard: non-admins can't see this page -->
    <div v-if="!isAdmin" class="text-center py-16">
      <div class="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center mx-auto mb-4">
        <svg class="w-7 h-7 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>
      <p class="text-sm text-text-muted">Only workspace admins can access the approval queue.</p>
    </div>

    <ApprovalQueuePanel v-else @select="openDocument" />

    <!-- Document detail modal -->
    <DocumentDetailModal
      v-if="showModal && selectedDocId"
      :documentId="selectedDocId"
      :document-image="selectedDoc?.image"
      :document-text="selectedDoc?.cleanedText"
      :extracted-fields="selectedDoc?.extracted"
      @close="closeModal"
      @updated="closeModal"
    />
  </div>
</template>
