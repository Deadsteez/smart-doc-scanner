<script setup>
import { computed } from 'vue'
import { useAuth } from '~/composables/useAuth'

const { user, logout } = useAuth()

// Get first two letters from the email (before the @)
const userInitials = computed(() => {
  const email = user.value?.email ?? ''
  return email.slice(0, 2).toUpperCase()
})

const handleLogout = async () => {
  await logout()
  navigateTo('/login')
}
</script>

<template>
<nav class="w-full border-b border-gray-800 bg-black px-6 py-3 flex items-center justify-between sticky top-0 z-50">

    <!-- Left: brand + links -->
<div class="flex items-center gap-6">
  <span class="text-white font-bold tracking-tight text-sm">
     SmartScan 🔍
  </span>
  <NuxtLink
    to="/"
    class="text-gray-400 hover:text-white text-sm transition-colors"
    active-class="!text-white"
    exact-active-class="!text-white"
  >
    Dashboard
  </NuxtLink>
  <NuxtLink
    to="/scan"
    class="text-gray-400 hover:text-white text-sm transition-colors"
    active-class="!text-white"
    exact-active-class="!text-white"
  >
    Scan
  </NuxtLink>
</div>

    <!-- Right: auth -->
    <div class="flex items-center gap-3">

      <!-- Logged in: avatar + logout -->
      <template v-if="user">
        <div class="flex items-center gap-2">
          <!-- Avatar circle with initials -->
          <div
            class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold tracking-wide select-none"
            :title="user.email"
          >
            {{ userInitials }}
          </div>
          <span class="text-gray-400 text-sm hidden sm:block">{{ user.email }}</span>
        </div>

        <button
          @click="handleLogout"
          class="text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          Logout
        </button>
      </template>

      <!-- Logged out: login + signup -->
      <template v-else>
        <NuxtLink
          to="/login"
          class="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Login
        </NuxtLink>
        <NuxtLink
          to="/register"
          class="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          Sign up
        </NuxtLink>
      </template>

    </div>
  </nav>
</template>