<script setup>
import { computed } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useTheme } from '~/composables/useTheme'

const { user, logout } = useAuth()
const { isDark, toggle: toggleTheme } = useTheme()

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
<nav class="w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black px-6 py-3 flex items-center justify-between sticky top-0 z-50 transition-colors">

<div class="flex items-center gap-6">
  <span class="text-gray-900 dark:text-white font-bold tracking-tight text-sm">
     SmartScan 
  </span>
  <NuxtLink
    to="/"
    class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
    active-class="!text-gray-900 dark:!text-white"
    exact-active-class="!text-gray-900 dark:!text-white"
  >
    Dashboard
  </NuxtLink>
  <NuxtLink
    to="/scan"
    class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
    active-class="!text-gray-900 dark:!text-white"
    exact-active-class="!text-gray-900 dark:!text-white"
  >
    Scan
  </NuxtLink>
</div>
    <div class="flex items-center gap-3">

  <button
    @click="toggleTheme"
    class="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <svg v-if="isDark" class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
    </svg>
    <svg v-else class="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  </button>

<template v-if="user">
  <div class="flex items-center gap-2">
  <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold tracking-wide select-none" title="user.email">
    {{ userInitials }}
   </div>
  <span class="text-gray-400 text-sm hidden sm:block">{{ user.email }}</span>
  </div>

<button @click="handleLogout" class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors">
  Logout </button>
</template>

<template v-else>
  <NuxtLink to="/login" class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"> Login </NuxtLink>
  <NuxtLink to="/register" class="text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"> Sign up </NuxtLink>
</template>

</div>
</nav>
</template>