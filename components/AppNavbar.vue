<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useTheme } from '~/composables/useTheme'
import { onClickOutside } from '@vueuse/core'

const { user, logout } = useAuth()
const { isDark, toggle: toggleTheme } = useTheme()

const userInitials = computed(() => {
  const email = user.value?.email ?? ''
  return email.slice(0, 2).toUpperCase()
})


const profileMenuRef = ref(null)
onClickOutside(profileMenuRef, () => {
  showProfileMenu.value = false
})

const isScrolled = ref(false)
const showProfileMenu = ref(false)

function handleScroll() {
  isScrolled.value = window.scrollY > 10
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

const handleLogout = async () => {
  showProfileMenu.value = false
  await logout()
  navigateTo('/login')
}

function toggleProfileMenu() {
  showProfileMenu.value = !showProfileMenu.value
}

// Close menu on click outside
function closeMenuOnOutside() {
  showProfileMenu.value = false
}
</script>

<template>
  <!-- Floating top navbar — desktop-first, hidden on mobile (bottom nav handles it) -->
  <nav class="sticky top-0 z-50 hidden md:block">
    <div class="mx-4 mt-3">
      <div
        :class="[
  'glass-panel rounded-full px-5 py-2.5 flex items-center justify-between max-w-[1440px] mx-auto transition-all duration-300 border',
  isScrolled
    ? 'bg-bg-primary/90 border-slate-1/20 shadow-elevated backdrop-blur-md'
    : 'bg-bg-primary/70 border-transparent'
]" 
      >
        <!-- Left: Logo + Nav links -->
        <div class="flex items-center gap-8">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-2.5 group">
            <div class="w-8 h-8 rounded-lg bg-accent-primary/15 flex items-center justify-center group-hover:bg-accent-primary/25 transition-colors">
              <svg class="w-4.5 h-4.5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span class="text-text-primary font-semibold tracking-tight text-sm">
              SmartScan
            </span>
          </NuxtLink>

          <!-- Nav links -->
          <div class="flex items-center gap-1">
            <NuxtLink
              to="/dashboard"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              :class="$route.path === '/dashboard'
                ? 'text-text-primary bg-bg-tertiary/60'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/30'"
            >
              Dashboard
            </NuxtLink>
            <NuxtLink
              to="/scan"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              :class="$route.path === '/scan'
                ? 'text-text-primary bg-bg-tertiary/60'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/30'"
            >
              Scan
            </NuxtLink>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-3">
          <!-- Scan CTA button -->
          <NuxtLink
            to="/scan"
            class="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:scale-95 shadow-glow-cyan"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Scan
          </NuxtLink>

          <!-- Theme toggle -->
          <button
            @click="toggleTheme"
            class="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/40 transition-colors"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <svg v-if="isDark" class="w-5 h-5 text-warning" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          </button>

          <!-- User section -->

          <template v-if="user">
  <div class="relative">
    <!-- Avatar Button -->
    <button
      @click="toggleProfileMenu"
      aria-label="Open profile menu"
      class="flex items-center gap-2 p-1 rounded-lg hover:bg-bg-tertiary/40 transition-all duration-200"
    >
      <div
        class="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary text-xs font-bold tracking-wide select-none ring-1 ring-accent-primary/30 hover:bg-accent-primary/30 transition-colors"
      >
        {{ userInitials }}
      </div>
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-1 scale-95"
    >
      <div
        v-if="showProfileMenu"
        ref="profileMenuRef"
        class="absolute right-0 top-[calc(100%+0.5rem)] w-60 rounded-2xl overflow-hidden border border-slate-1/30 shadow-elevated bg-bg-elevated"
      >
        <!-- User Info -->
        <div class="px-4 py-3 border-b border-slate-1/30">
          <p class="text-sm text-text-primary font-medium truncate">
            {{ user.email }}
          </p>
          <p class="text-xs text-text-muted mt-1">
            Signed in
          </p>
        </div>

        <!-- Menu Items -->
        <div class="p-2">
          <NuxtLink
            to="/profile"
            :class="[
            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
            $route.path.startsWith('/profile')
                ? 'bg-bg-tertiary/60 text-text-primary'
                : 'text-text-secondary hover:bg-bg-tertiary/40 hover:text-text-primary'
            ]"
            @click="showProfileMenu = false"
          >
            Profile
          </NuxtLink>

          <NuxtLink
            to="/settings"
            class="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-text-secondary hover:bg-bg-tertiary/40 hover:text-text-primary transition-colors"
            @click="showProfileMenu = false"
          >
            Settings
          </NuxtLink>

          <button
            @click="handleLogout"
            class="w-full text-left px-3 py-2 rounded-xl text-sm text-error hover:bg-error/10 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

          <template v-else>
            <NuxtLink
              to="/login"
              class="text-sm text-text-muted hover:text-text-primary transition-colors px-3 py-1.5"
            >
              Login
            </NuxtLink>
            <NuxtLink
              to="/register"
              class="text-sm bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 px-4 py-2 rounded-xl font-medium transition-colors"
            >
              Sign up
            </NuxtLink>
          </template>
        </div>
      </div>
    </div>
  </nav>

  <!-- Mobile top bar — simplified, shown only on small screens -->
  <nav class="sticky top-0 z-40 md:hidden glass-panel border-b border-slate-1/30">
    <div class="flex items-center justify-between px-4 py-3">
      <NuxtLink to="/" class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-accent-primary/15 flex items-center justify-center">
          <svg class="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span class="text-text-primary font-semibold text-sm">SmartScan</span>
      </NuxtLink>

      <div class="flex items-center gap-2">
        <button
          @click="toggleTheme"
          class="p-2 rounded-lg text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg v-if="isDark" class="w-4 h-4 text-warning" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        </button>

<template v-if="user">
  <NuxtLink
    to="/profile"
    aria-label="Go to profile"
    class="w-7 h-7 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary text-[10px] font-bold select-none ring-1 ring-accent-primary/30 hover:bg-accent-primary/30 transition-colors"
  >
    {{ userInitials }}
  </NuxtLink>
</template>
      </div>
    </div>
  </nav>
</template>