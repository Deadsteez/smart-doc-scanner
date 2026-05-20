<script setup>
import { ref } from 'vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)
const { login } = useAuth()

const handleLogin = async () => {
  errorMsg.value = ''
  loading.value = true
  
  const { data, error } = await login(email.value, password.value)

  loading.value = false

  if (error) {
    errorMsg.value = error.message
  } else {
    navigateTo('/scan')
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg-primary flex items-center justify-center px-4">
    <div class="w-full max-w-md bg-bg-secondary border border-slate-1/40 rounded-2xl p-8 shadow-elevated">

      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <div class="w-12 h-12 rounded-xl bg-accent-primary/15 flex items-center justify-center mb-3">
          <svg class="w-6 h-6 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span class="text-text-primary font-semibold tracking-tight text-lg">SmartScan</span>
      </div>

      <!-- Heading -->
      <h2 class="text-text-primary text-2xl font-semibold mb-1">Welcome back</h2>
      <p class="text-text-muted text-sm mb-6">Sign in to your account</p>

      <!-- Email field -->
      <div class="mb-4">
        <label class="block text-text-muted text-sm mb-1.5">Email</label>
        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-slate-1/40 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
        />
      </div>

      <!-- Password field -->
      <div class="mb-6">
        <label class="block text-text-muted text-sm mb-1.5">Password</label>
        <input
          v-model="password"
          type="password"
          placeholder="••••••••"
          class="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary border border-slate-1/40 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
          @keyup.enter="handleLogin"
        />
      </div>

      <!-- Submit button -->
      <button
        @click="handleLogin"
        :disabled="loading"
        class="w-full bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
      >
        <div v-if="loading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        {{ loading ? 'Signing in…' : 'Login' }}
      </button>

      <!-- Error message -->
      <p v-if="errorMsg" class="text-error text-sm mt-3">{{ errorMsg }}</p>

      <!-- Register link -->
      <p class="text-text-muted text-sm mt-5 text-center">
        Don't have an account?
        <NuxtLink to="/register" class="text-accent-primary hover:underline">Create one</NuxtLink>
      </p>

    </div>
  </div>
</template>