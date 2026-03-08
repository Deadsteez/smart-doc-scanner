<script setup>
import { ref } from 'vue'
import { useAuth } from '~/composables/useAuth'

const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)
const { login } = useAuth()

const handleLogin = async () => {
  errorMsg.value = ''
  loading.value = true

  // Supabase returns { data, error } — NOT { error } at the top level.
  // The old code did `const { error: err } = await login(...)` which always
  // got undefined because the real error is nested inside the response object.
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
  <div class="min-h-screen bg-black flex items-center justify-center px-4">
    <div class="w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl p-8">

      <h2 class="text-2xl font-semibold text-white mb-1">Welcome back</h2>
      <p class="text-gray-400 text-sm mb-6">Sign in to your account</p>

      <div class="mb-4">
        <label class="block text-sm text-gray-400 mb-1">Email</label>
        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="w-full px-4 py-2 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
        />
      </div>

      <div class="mb-6">
        <label class="block text-sm text-gray-400 mb-1">Password</label>
        <input
          v-model="password"
          type="password"
          placeholder="••••••••"
          class="w-full px-4 py-2 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
          @keyup.enter="handleLogin"
        />
      </div>

      <button
        @click="handleLogin"
        :disabled="loading"
        class="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2"
      >
        <div v-if="loading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        {{ loading ? 'Signing in…' : 'Login' }}
      </button>

      <p v-if="errorMsg" class="text-red-400 text-sm mt-3">{{ errorMsg }}</p>

      <p class="text-gray-500 text-sm mt-5 text-center">
        Don't have an account?
        <NuxtLink to="/register" class="text-blue-400 hover:underline">Create one</NuxtLink>
      </p>

    </div>
  </div>
</template>