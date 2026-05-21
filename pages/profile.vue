<script setup>
import { computed } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useTheme } from '~/composables/useTheme'
import { useDocumentStore } from '~/stores/documentStore'

const { user, logout } = useAuth()
const { isDark, toggle: toggleTheme } = useTheme()
const documentStore = useDocumentStore()

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
  <div class="p-6 max-w-2xl mx-auto font-sans animate-fade-in">
    
    <div class="mb-8">
      <h1 class="text-2xl font-semibold text-text-primary">Your Profile</h1>
      <p class="text-sm text-text-muted mt-1">Manage your account and preferences.</p>
    </div>

    <!-- User Information Card -->
    <div class="bg-bg-secondary  rounded-2xl p-6 shadow-elevated hover-card mb-6 flex items-center gap-6">
      <div class="w-16 h-16 rounded-full bg-accent-primary/20 flex flex-shrink-0 items-center justify-center text-accent-primary text-xl font-bold tracking-wide select-none ring-2 ring-accent-primary/30">
        {{ userInitials }}
      </div>
      <div>
        <h2 class="text-lg font-semibold text-text-primary">{{ user?.email || 'Not signed in' }}</h2>
        <p class="text-sm text-text-muted mt-0.5">Free Plan</p>
      </div>
    </div>

    <!-- Settings & Stats -->
    <div class="grid sm:grid-cols-2 gap-6 mb-8">
      
      <!-- Preferences -->
      <div class="bg-bg-secondary  rounded-2xl p-6 shadow-elevated hover-card">
        <h3 class="text-text-primary font-medium mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Preferences
        </h3>
        
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-text-primary">Dark Mode</p>
            <p class="text-xs text-text-muted mt-0.5">Toggle app appearance</p>
          </div>
          <!-- Custom Toggle Switch -->
          <button 
            @click="toggleTheme" 
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:ring-offset-2 focus:ring-offset-bg-primary"
            :class="isDark ? 'bg-accent-primary' : 'bg-slate-2'"
          >
            <span 
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              :class="isDark ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
      </div>

      <!-- Account Stats -->
      <div class="bg-bg-secondary  rounded-2xl p-6 shadow-elevated hover-card">
        <h3 class="text-text-primary font-medium mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-accent-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Document Stats
        </h3>
        
        <div class="flex justify-between text-sm">
          <span class="text-text-muted">Total Documents</span>
          <span class="text-text-primary font-semibold">{{ documentStore.documents.length }}</span>
        </div>
        <div class="flex justify-between text-sm mt-3">
          <span class="text-text-muted">Cloud Sync Status</span>
          <span class="font-medium flex items-center gap-1.5" :class="documentStore.syncing ? 'text-warning' : 'text-success'">
            <div v-if="documentStore.syncing" class="w-3 h-3 border-2 border-warning border-t-transparent rounded-full animate-spin"></div>
            {{ documentStore.syncing ? 'Syncing...' : 'Up to date' }}
          </span>
        </div>
      </div>

    </div>

    <!-- Sign Out Button -->
    <button
      @click="handleLogout"
      class="w-full bg-error/15 text-error hover:bg-error/25 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 hover:-translate-y-0.5 shadow-card"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      Sign out
    </button>
  </div>
</template>
