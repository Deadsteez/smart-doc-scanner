<script setup>
import { ref } from 'vue'
import { useAuth } from '~/composables/useAuth'

const email = ref('')
const password = ref('')
const message = ref('')
const isSuccess = ref(false)
const loading = ref(false)
const { register } = useAuth()

const handleRegister = async () => {
  message.value = ''
  loading.value = true

  // Supabase returns { data, error } at the top level.
  // Destructure correctly — don't use the returned object as-is.
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
  <div class="min-h-screen bg-black flex items-center justify-center px-4">
    <div class="w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl p-8">

      <h2 class="text-2xl font-semibold text-white mb-1">Create account</h2>
      <p class="text-gray-400 text-sm mb-6">Sign up to get started</p>

      <div class="mb-4">
        <label class="block text-sm text-gray-400 mb-1">Email</label>
        <input
          v-model="email"
          type="email"
          placeholder="you@example.com"
          class="w-full px-4 py-2 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition"
        />
      </div>

      <div class="mb-6">
        <label class="block text-sm text-gray-400 mb-1">Password</label>
        <input
          v-model="password"
          type="password"
          placeholder="••••••••"
          class="w-full px-4 py-2 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition"
          @keyup.enter="handleRegister"
        />
      </div>

      <button
        @click="handleRegister"
        :disabled="loading"
        class="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2"
      >
        <div v-if="loading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        {{ loading ? 'Creating account…' : 'Register' }}
      </button>

      <p
        v-if="message"
        class="text-sm mt-3"
        :class="isSuccess ? 'text-green-400' : 'text-red-400'"
      >
        {{ message }}
      </p>

      <p class="text-gray-500 text-sm mt-5 text-center">
        Already have an account?
        <NuxtLink to="/login" class="text-blue-400 hover:underline">Sign in</NuxtLink>
      </p>

    </div>
  </div>
</template>