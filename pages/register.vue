<script setup>
import { ref } from 'vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const message = ref('')
const isSuccess = ref(false)
const loading = ref(false)
const { register } = useAuth()

const handleRegister = async () => {
  message.value = ''
  loading.value = true

  const { data, error } = await register(email.value, password.value)

  loading.value = false

  if (error) {
    isSuccess.value = false
    message.value = error.message
  } else {
    isSuccess.value = true
    message.value = 'Registration successful! You can now sign in.'
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg-primary flex items-center justify-center px-4">
    <div class="w-full max-w-md bg-bg-secondary  rounded-2xl p-8 shadow-elevated">

      <!-- Logo -->
      <div class="flex flex-col items-center mb-8">
        <div class="w-12 h-12 rounded-xl bg-accent-secondary/15 flex items-center justify-center mb-3">
          <svg class="w-6 h-6 text-accent-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span class="text-text-primary font-semibold tracking-tight text-lg">SmartScan</span>
      </div>

      <!-- Heading -->
      <h2 class="text-text-primary text-2xl font-semibold mb-1">Create account</h2>
      <p class="text-text-muted text-sm mb-6">Sign up to get started</p>

      <!-- Email field -->
      <div class="mb-4">
        <label class="block text-text-muted text-sm mb-1.5">Email</label>
        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary  text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
        />
      </div>

      <!-- Password field -->
      <div class="mb-6">
        <label class="block text-text-muted text-sm mb-1.5">Password</label>
        <input
          v-model="password"
          type="password"
          placeholder="••••••••"
          class="w-full px-4 py-2.5 rounded-xl bg-bg-tertiary  text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20 transition-all"
          @keyup.enter="handleRegister"
        />
      </div>

      <!-- Submit button -->
      <button
        @click="handleRegister"
        :disabled="loading"
        class="w-full bg-accent-secondary hover:bg-accent-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
      >
        <div v-if="loading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        {{ loading ? 'Creating account…' : 'Register' }}
      </button>

      <!-- Status message -->
      <p
        v-if="message"
        class="text-sm mt-3"
        :class="isSuccess ? 'text-success' : 'text-error'"
      >
        {{ message }}
      </p>

      <!-- Login link -->
      <p class="text-text-muted text-sm mt-5 text-center">
        Already have an account?
        <NuxtLink to="/login" class="text-accent-primary hover:underline">Sign in</NuxtLink>
      </p>

    </div>
  </div>
</template>