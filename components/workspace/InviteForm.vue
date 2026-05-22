<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '~/composables/useAuth'
import type { WorkspaceRole } from '~/types/workspace'

const { user } = useAuth()

const emit = defineEmits<{
  (e: 'invited', payload: { email: string; role: WorkspaceRole; inviteUrl?: string }): void
}>()

const props = defineProps<{
  workspaceId: string
}>()

const email = ref('')
const role = ref<WorkspaceRole>('member')
const loading = ref(false)
const error = ref('')
const successUrl = ref('')
const successMessage = ref('')

async function handleInvite() {
  if (!email.value.trim()) { error.value = 'Please enter an email address.'; return }
  error.value = ''
  successUrl.value = ''
  successMessage.value = ''
  loading.value = true

  try {

    const { getSupabase } = await import('~/services/supabaseClient')
    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()

    const result = await $fetch<{ success: boolean; inviteUrl?: string; emailSent?: boolean }>('/api/workspace/invite', {
      method: 'POST',
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
      body: { email: email.value.trim(), role: role.value, workspace_id: props.workspaceId },
    })

    if (result.inviteUrl && !result.emailSent) {

      successUrl.value = result.inviteUrl
    } else if (result.emailSent) {

      successMessage.value = `Invitation sent to ${email.value.trim()}!`
    }

    emit('invited', { email: email.value.trim(), role: role.value, inviteUrl: result.inviteUrl })
    email.value = ''
    role.value = 'member'
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Failed to send invite. Please try again.'
  } finally {
    loading.value = false
  }
}

function copyUrl() {
  if (successUrl.value) {
    navigator.clipboard.writeText(successUrl.value)
    successUrl.value = ''
  }
}
</script>

<template>
  <div id="invite-form" class="space-y-3">
    <h3 class="text-sm font-semibold text-text-primary">Invite a Member</h3>

    <div class="flex gap-2">
      <!-- Email input -->
      <input v-model="email" type="email" id="invite-email-input" placeholder="colleague@example.com"
        class="flex-1 px-4 py-2.5 rounded-xl bg-bg-secondary border border-slate-1 text-text-primary placeholder-text-muted text-sm focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all"
        @keydown.enter="handleInvite" />

      <!-- Role dropdown -->
      <select v-model="role" id="invite-role-select"
        class="px-3 py-2.5 rounded-xl bg-bg-secondary border border-slate-1 text-text-primary text-sm focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 focus:outline-none transition-all">
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>

      <!-- Send button -->
      <button id="invite-send-btn" @click="handleInvite" :disabled="loading"
        class="flex items-center gap-2 px-4 py-2.5 bg-accent-primary hover:bg-sky-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 active:scale-95 shadow-[0_2px_8px_rgba(2,132,199,0.3)]">
        <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12a8 8 0 018-8" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
        Send
      </button>
    </div>

    <!-- Error -->
    <p v-if="error" class="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
      {{ error }}
    </p>

    <!-- Fallback invite URL (when Resend not configured) -->
    <div v-if="successUrl" class="bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
      <p class="text-xs text-warning font-semibold mb-2">✅ Invite link created! Share it manually:</p>
      <div class="flex gap-2">
        <code
          class="flex-1 text-xs text-text-secondary bg-bg-secondary rounded-lg px-3 py-2 truncate border border-slate-1/30">
          {{ successUrl }}
        </code>
        <button @click="copyUrl"
          class="px-3 py-2 bg-warning/15 text-warning hover:bg-warning/25 rounded-lg text-xs font-semibold transition-colors">
          Copy
        </button>
      </div>
    </div>

    <!-- Success message (when email sent successfully) -->
    <div v-else-if="successMessage" class="bg-success/10 border border-success/20 rounded-xl px-4 py-3">
      <p class="text-sm text-success font-semibold flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {{ successMessage }}
      </p>
    </div>
  </div>
</template>
