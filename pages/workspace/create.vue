<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspaceStore } from '~/stores/workspaceStore'

definePageMeta({ layout: false })

const workspaceStore = useWorkspaceStore()
const name = ref('')
const loading = ref(false)
const error = ref('')

async function handleCreate() {
  if (!name.value.trim()) { error.value = 'Please enter a workspace name.'; return }
  error.value = ''
  loading.value = true
  const ws = await workspaceStore.createWorkspace({ name: name.value.trim() })
  loading.value = false
  if (ws) {
    await navigateTo('/workspace')
  } else {
    error.value = workspaceStore.error ?? 'Failed to create workspace.'
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg-primary flex items-center justify-center p-6">
    <div class="w-full max-w-md">

      <!-- Logo -->
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <div class="w-10 h-10 rounded-xl bg-accent-primary/15 flex items-center justify-center">
          <svg class="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
        </div>
        <span class="text-text-primary font-bold text-xl tracking-tight">SmartScan</span>
      </div>

      <!-- Card -->
      <div class="glass-panel rounded-2xl        -slate-1/40 p-8 shadow-elevated">
        <h1 class="text-xl font-semibold text-text-primary mb-1">Create a Workspace</h1>
        <p class="text-text-muted text-sm mb-6">A workspace lets you collaborate and share documents with your team.</p>

        <div class="space-y-4">
          <div>
            <label class="text-xs text-text-muted uppercase tracking-wider font-medium block mb-1.5" for="workspace-name-input">
              Workspace Name
            </label>
            <input
              id="workspace-name-input"
              v-model="name"
              type="text"
              placeholder="e.g. Acme Corp Accounting"
              class="w-full px-4 py-3 rounded-xl bg-bg-secondary        -slate-1 text-text-primary placeholder-text-muted text-sm focus:   -accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all"
              @keydown.enter="handleCreate"
            />
          </div>

          <p v-if="error" class="text-xs text-error bg-error/10        -error/20 rounded-lg px-3 py-2">
            {{ error }}
          </p>

          <button
            id="create-workspace-btn"
            @click="handleCreate"
            :disabled="loading"
            class="w-full flex items-center justify-center gap-2 py-3 bg-accent-primary hover:bg-sky-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(2,132,199,0.3)] active:scale-[0.98] disabled:opacity-50"
          >
            <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12a8 8 0 018-8"/></svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            {{ loading ? 'Creating…' : 'Create Workspace' }}
          </button>

          <NuxtLink to="/workspace" class="block text-center text-sm text-text-muted hover:text-text-secondary transition-colors mt-2">
            Cancel
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

