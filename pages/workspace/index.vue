<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useWorkspaceStore } from '~/stores/workspaceStore'
import { useDocumentStore } from '~/stores/documentStore'
import { usePermissions } from '~/composables/usePermissions'
import ApprovalStatusBadge from '~/components/workspace/ApprovalStatusBadge.vue'
import DocumentDetailModal from '~/components/workspace/DocumentDetailModal.vue'



const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()
const { isAdmin } = usePermissions()

const selectedDocId = ref<string | null>(null)
const showModal = ref(false)

onMounted(async () => {
  document.addEventListener('click', closeDropdown)
  await documentStore.loadAll()
  if (!workspaceStore.currentWorkspace) {
    await workspaceStore.fetchWorkspaces()
  } else {
    // Re-fetch members and approvals to ensure counts are fresh
    await workspaceStore.fetchMembers(workspaceStore.currentWorkspace.id)
    await workspaceStore.fetchApprovals(workspaceStore.currentWorkspace.id)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})

const isDropdownOpen = ref(false)

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
}

function selectWs(id: string) {
  workspaceStore.selectWorkspace(id)
  isDropdownOpen.value = false
}

function closeDropdown(e: Event) {
  const target = e.target as HTMLElement
  if (!target.closest('.workspace-dropdown')) {
    isDropdownOpen.value = false
  }
}

const workspaceDocuments = computed(() => {
  if (!workspaceStore.currentWorkspace) return []
  return documentStore.documents.filter(
    d => d.workspaceId === workspaceStore.currentWorkspace?.id
  )
})

function openDocument(docId: string) {
  selectedDocId.value = docId
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  selectedDocId.value = null
}

const selectedDoc = computed(() =>
  documentStore.documents.find(d => (d as any).supabaseId === selectedDocId.value) ?? null
)

function categoryClass(category: any) {
  return {
    receipt: 'bg-accent-primary/15 text-accent-primary',
    invoice: 'bg-success/15 text-success',
    bill: 'bg-accent-secondary/15 text-accent-secondary',
    other: 'bg-slate-1/30 text-text-muted',
  }[category?.type] || 'bg-slate-1/30 text-text-muted'
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto animate-fade-in">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
      <div class="relative workspace-dropdown z-20">
        <template v-if="workspaceStore.workspaces.length > 0">
          <button 
            @click="toggleDropdown" 
            class="flex items-center gap-2 text-2xl font-semibold text-text-primary hover:text-accent-primary transition-colors focus:outline-none"
          >
            {{ workspaceStore.currentWorkspace?.name }}
            <svg class="w-5 h-5 text-text-muted transition-transform duration-200" :class="{ 'rotate-180': isDropdownOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>

          <!-- Custom Dropdown Menu -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <div v-if="isDropdownOpen" class="absolute top-full left-0 mt-3 w-64 bg-bg-elevated      -slate-1/40 rounded-xl shadow-elevated py-1.5 overflow-hidden">
              <button 
                v-for="ws in workspaceStore.workspaces" 
                :key="ws.id"
                @click="selectWs(ws.id)"
                class="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-bg-tertiary flex items-center justify-between"
                :class="ws.id === workspaceStore.currentWorkspace?.id ? 'text-accent-primary font-medium bg-accent-primary/5' : 'text-text-secondary'"
              >
                <span class="truncate pr-2">{{ ws.name }}</span>
                <svg v-if="ws.id === workspaceStore.currentWorkspace?.id" class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              </button>
            </div>
          </Transition>
        </template>
        <h1 v-else class="text-2xl font-semibold text-text-primary">Workspace</h1>
        
        <p class="text-text-muted text-sm mt-1">
          {{ workspaceStore.members.length }} member{{ workspaceStore.members.length !== 1 ? 's' : '' }} ·
          {{ workspaceStore.approvals.length }} document{{ workspaceStore.approvals.length !== 1 ? 's' : '' }} in review
        </p>
      </div>

      <div class="flex gap-2">
        <NuxtLink
          v-if="isAdmin"
          to="/workspace/approvals"
          class="flex items-center gap-2 px-4 py-2 bg-warning/15 text-warning hover:bg-warning/25 rounded-xl text-sm font-semibold transition-all"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/>
          </svg>
          Review Queue
          <span v-if="workspaceStore.pendingApprovals.length > 0" class="bg-warning text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
            {{ workspaceStore.pendingApprovals.length }}
          </span>
        </NuxtLink>

        <NuxtLink
          to="/workspace/settings"
          class="flex items-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary      -slate-1/30 rounded-xl text-sm text-text-secondary font-medium transition-all"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          Settings
        </NuxtLink>

        <NuxtLink
          to="/workspace/create"
          class="flex items-center gap-2 px-4 py-2 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 rounded-xl text-sm font-semibold transition-all"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          New Workspace
        </NuxtLink>
      </div>
    </div>

    <!-- No workspace state -->
    <div v-if="!workspaceStore.currentWorkspace" class="text-center py-16">
      <div class="w-16 h-16 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto mb-5">
        <svg class="w-8 h-8 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
      </div>
      <h2 class="text-lg font-semibold text-text-primary mb-2">No workspace yet</h2>
      <p class="text-text-muted text-sm mb-6">Create a workspace to collaborate with your team.</p>
      <NuxtLink
        to="/workspace/create"
        class="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary hover:bg-sky-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(2,132,199,0.3)]"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        Create Workspace
      </NuxtLink>
    </div>

    <!-- Document list with approval status -->
    <template v-else>
      <div v-if="workspaceDocuments.length === 0" class="text-center py-14 text-text-muted">
        <p class="text-sm">No documents in this workspace yet.</p>
        <p class="text-xs mt-1 text-text-muted/60">Scan documents and submit them for approval here.</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="doc in workspaceDocuments"
          :key="doc.id"
          class="bg-bg-secondary      -slate-1 rounded-xl shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 p-4 cursor-pointer"
          @click="openDocument((doc as any).supabaseId)"
        >
          <!-- Image preview -->
          <div v-if="doc.image" class="mb-3 h-28 bg-bg-tertiary rounded-lg overflow-hidden">
            <img :src="doc.image" class="object-cover h-full w-full opacity-90" />
          </div>

          <!-- Meta row -->
          <div class="flex justify-between items-center mb-2 gap-2">
            <span class="text-xs text-text-muted">{{ new Date(doc.createdAt).toLocaleDateString() }}</span>
            <div class="flex items-center gap-1.5">
              <span class="text-xs px-2 py-0.5 rounded-lg uppercase tracking-wide font-medium" :class="categoryClass(doc.category)">
                {{ doc.category?.type ?? 'other' }}
              </span>
            </div>
          </div>

          <!-- Approval status badge -->
          <div class="mt-2">
            <ApprovalStatusBadge
              v-if="workspaceStore.getApprovalForDocument((doc as any).supabaseId)"
              :status="workspaceStore.getApprovalForDocument((doc as any).supabaseId)!.status"
              size="sm"
            />
            <span v-else class="text-xs text-text-muted/60 italic">Not submitted</span>
          </div>

          <p class="text-xs text-text-secondary mt-2 line-clamp-2 whitespace-pre-wrap">
            {{ doc.cleanedText?.slice(0, 120) ?? '' }}…
          </p>
        </div>
      </div>
    </template>

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
