<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getSupabase } from '~/services/supabaseClient'
import { useWorkspaceStore } from '~/stores/workspaceStore'

definePageMeta({ layout: false })

const route = useRoute()
const supabase = getSupabase()

const state = ref('loading') // 'loading' | 'signing-in' | 'accepting' | 'success' | 'error'
const errorMessage = ref('')
const workspaceId = ref('')

onMounted(async () => {
  const token = route.query.token as string | undefined

  if (!token) {
    state.value = 'error'
    errorMessage.value = 'No invite token found in the URL. Please use the link from your invitation email.'
    return
  }

  // ── Ensure user is authenticated ────────────────────────────
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    // Save token to localStorage and redirect to login, then come back
    if (import.meta.client) {
      localStorage.setItem('pending_invite_token', token)
    }
    state.value = 'signing-in'
    await navigateTo(`/login?redirect=/invite?token=${encodeURIComponent(token)}`)
    return
  }

  // ── Accept the invite ────────────────────────────────────────
  state.value = 'accepting'
  try {
    const data = await $fetch('/api/workspace/accept-invite', {
      method: 'POST',
      body: { token, user_id: session.user.id },
    })

    workspaceId.value = data.workspace_id
    state.value = 'success'

    // Clean up pending invite from storage
    if (import.meta.client) localStorage.removeItem('pending_invite_token')

    // Auto-select the newly joined workspace
    const workspaceStore = useWorkspaceStore()
    await workspaceStore.fetchWorkspaces()
    await workspaceStore.selectWorkspace(data.workspace_id)

    // Redirect to workspace after short delay
    setTimeout(() => navigateTo('/workspace'), 1800)
  } catch (err) {
    state.value = 'error'
    errorMessage.value = err?.data?.statusMessage ?? 'Something went wrong accepting the invite.'
  }
})
</script>

<template>
  <div class="min-h-screen bg-bg-primary flex items-center justify-center p-6">
    <div class="w-full max-w-md">

      <!-- Logo -->
      <div class="flex items-center justify-center gap-2.5 mb-8">
        <div class="w-10 h-10 rounded-xl bg-accent-primary/15 flex items-center justify-center">
          <svg class="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span class="text-text-primary font-bold text-xl tracking-tight">SmartScan</span>
      </div>

      <!-- Card -->
      <div class="glass-panel rounded-2xl border border-slate-1/40 p-8 shadow-elevated text-center">

        <!-- Loading / Processing -->
        <template v-if="state === 'loading' || state === 'accepting' || state === 'signing-in'">
          <div class="w-14 h-14 rounded-full bg-accent-primary/10 flex items-center justify-center mx-auto mb-5">
            <div class="w-7 h-7 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <h1 class="text-xl font-semibold text-text-primary mb-2">
            {{ state === 'signing-in' ? 'Redirecting to sign in…' : 'Accepting your invitation…' }}
          </h1>
          <p class="text-text-muted text-sm">Please wait a moment.</p>
        </template>

        <!-- Success -->
        <template v-else-if="state === 'success'">
          <div class="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
            <svg class="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 class="text-xl font-semibold text-text-primary mb-2">You're in! 🎉</h1>
          <p class="text-text-muted text-sm mb-6">You've successfully joined the workspace. Redirecting you now…</p>
          <NuxtLink
            to="/workspace"
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary/15 text-accent-primary rounded-xl text-sm font-medium hover:bg-accent-primary/25 transition-colors"
          >
            Go to Workspace
          </NuxtLink>
        </template>

        <!-- Error -->
        <template v-else-if="state === 'error'">
          <div class="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-5">
            <svg class="w-7 h-7 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 class="text-xl font-semibold text-text-primary mb-2">Invite Failed</h1>
          <p class="text-sm text-text-muted mb-6">{{ errorMessage }}</p>
          <NuxtLink
            to="/login"
            class="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary/15 text-accent-primary rounded-xl text-sm font-medium hover:bg-accent-primary/25 transition-colors"
          >
            Go to Login
          </NuxtLink>
        </template>

      </div>

    </div>
  </div>
</template>
