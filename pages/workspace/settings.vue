<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWorkspaceStore } from '~/stores/workspaceStore'
import { usePermissions } from '~/composables/usePermissions'
import WorkspaceMemberList from '~/components/workspace/WorkspaceMemberList.vue'
import InviteForm from '~/components/workspace/InviteForm.vue'



const workspaceStore = useWorkspaceStore()
const { isAdmin } = usePermissions()

const editingName = ref(false)
const newName = ref('')
const savingName = ref(false)

onMounted(() => {
  newName.value = workspaceStore.currentWorkspace?.name ?? ''
})

async function saveName() {
  if (!newName.value.trim()) return
  savingName.value = true
  await workspaceStore.updateWorkspaceName(newName.value.trim())
  savingName.value = false
  editingName.value = false
}

function onInvited({ email, role, inviteUrl }: any) {
  // Member list will refresh after next fetchMembers call
  // If no email service: inviteUrl is shown in the InviteForm itself
}

async function deleteCurrentWorkspace() {
  if (!workspaceStore.currentWorkspace) return
  if (confirm(`Are you absolutely sure you want to delete ${workspaceStore.currentWorkspace.name}? This cannot be undone.`)) {
    const success = await workspaceStore.deleteWorkspace(workspaceStore.currentWorkspace.id)
    if (success) {
      navigateTo('/workspace')
    }
  }
}
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
      <h1 class="text-xl font-semibold text-text-primary">Workspace Settings</h1>
    </div>

    <!-- Workspace name -->
    <section class="bg-bg-secondary rounded-2xl border border-slate-1/30 p-6 mb-5">
      <h2 class="text-sm font-semibold text-text-primary mb-4">General</h2>
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <label class="text-xs text-text-muted uppercase tracking-wider font-medium block mb-1.5">Workspace Name</label>
          <input
            v-if="editingName"
            v-model="newName"
            class="w-full px-4 py-2.5 rounded-xl bg-bg-primary border border-accent-primary text-text-primary text-sm focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all"
            @keydown.enter="saveName"
            @keydown.esc="editingName = false"
          />
          <p v-else class="text-sm text-text-primary font-medium px-1">{{ workspaceStore.currentWorkspace?.name }}</p>
        </div>

        <div class="flex gap-2 flex-shrink-0">
          <template v-if="isAdmin">
            <template v-if="editingName">
              <button @click="saveName" :disabled="savingName"
                class="px-3 py-2 bg-success/15 text-success hover:bg-success/25 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                Save
              </button>
              <button @click="editingName = false"
                class="px-3 py-2 bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80 rounded-xl text-sm transition-all">
                Cancel
              </button>
            </template>
            <button v-else @click="editingName = true"
              class="px-3 py-2 bg-bg-tertiary text-text-secondary hover:bg-bg-tertiary/80 rounded-xl text-sm transition-all">
              Rename
            </button>
          </template>
        </div>
      </div>

      <div class="mt-4 pt-4 border-t border-slate-1/20">
        <label class="text-xs text-text-muted uppercase tracking-wider font-medium block mb-1">Workspace Slug</label>
        <code class="text-xs text-text-muted bg-bg-primary px-3 py-1.5 rounded-lg border border-slate-1/20">
          {{ workspaceStore.currentWorkspace?.slug ?? '—' }}
        </code>
      </div>
    </section>

    <!-- Members -->
    <section class="bg-bg-secondary rounded-2xl border border-slate-1/30 p-6 mb-5">
      <h2 class="text-sm font-semibold text-text-primary mb-4">Members</h2>
      <WorkspaceMemberList />
    </section>

    <!-- Invite (Admin only) -->
    <section v-if="isAdmin" class="bg-bg-secondary rounded-2xl border border-slate-1/30 p-6 mb-5">
      <InviteForm
        :workspace-id="workspaceStore.currentWorkspace?.id ?? ''"
        @invited="onInvited"
      />
    </section>

    <!-- Danger Zone (Owner only) -->
    <section v-if="workspaceStore.currentWorkspace?.owner_id === workspaceStore.currentUserId" class="bg-error/5 rounded-2xl border border-error/20 p-6">
      <h2 class="text-sm font-semibold text-error mb-2">Danger Zone</h2>
      <p class="text-xs text-text-muted mb-4">Deleting this workspace will permanently remove all associated documents, members, and approval requests. This action cannot be undone.</p>
      
      <button 
        @click="deleteCurrentWorkspace"
        :disabled="workspaceStore.loading"
        class="px-4 py-2 bg-error text-white hover:bg-red-600 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
      >
        Delete Workspace
      </button>
    </section>

  </div>
</template>
