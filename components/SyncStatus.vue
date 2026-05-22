<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSyncManager } from '~/composables/useSyncManager'

const syncManager = useSyncManager()
const { syncState, syncNow, getLastSyncDisplay, getRetryCountdown } = syncManager

const retryCountdown = ref(0)

onMounted(() => {

  const interval = setInterval(() => {
    retryCountdown.value = getRetryCountdown()
  }, 1000)

  return () => clearInterval(interval)
})

const syncStatusText = computed(() => {
  if (syncState.value.isSyncing) return 'Syncing...'
  if (!syncState.value.isOnline) return 'Offline'
  if (syncState.value.nextRetryTime) return `Retry in ${retryCountdown.value}s`
  if (syncState.value.lastSyncTime) return `Synced ${getLastSyncDisplay()}`
  return 'Ready to sync'
})

const syncStatusColor = computed(() => {
  if (!syncState.value.isOnline) return 'text-warning'
  if (syncState.value.isSyncing) return 'text-info animate-pulse'
  if (syncState.value.nextRetryTime) return 'text-error'
  if (syncState.value.lastSyncTime) return 'text-success'
  return 'text-text-muted'
})

const syncStatusIcon = computed(() => {
  if (syncState.value.isSyncing) return 'spinner'
  if (!syncState.value.isOnline) return 'cloud-off'
  if (syncState.value.nextRetryTime) return 'alert-circle'
  if (syncState.value.lastSyncTime) return 'check-circle'
  return 'cloud'
})

const canSync = computed(() => {
  return syncState.value.isOnline && !syncState.value.isSyncing
})

const showErrorDetail = computed(() => {
  return syncState.value.failedCount > 0 && syncState.value.errorMessage
})
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-2 rounded-lg bg-bg-secondary border border-slate-2 transition-all">

    <div :class="syncStatusColor" class="flex-shrink-0">
      <svg v-if="syncStatusIcon === 'spinner'" class="w-4 h-4 animate-spin" fill="none" stroke="currentColor"
        viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <svg v-else-if="syncStatusIcon === 'cloud-off'" class="w-4 h-4" fill="none" stroke="currentColor"
        viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M20.354 15.354A9 9 0 008.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
      <svg v-else-if="syncStatusIcon === 'alert-circle'" class="w-4 h-4" fill="none" stroke="currentColor"
        viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <svg v-else-if="syncStatusIcon === 'check-circle'" class="w-4 h-4" fill="none" stroke="currentColor"
        viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-9" />
      </svg>
    </div>

    <!-- Status Text -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-text-primary truncate">{{ syncStatusText }}</p>
      <div v-if="showErrorDetail" class="text-xs text-error mt-0.5">
        {{ syncState.errorMessage }}
      </div>
      <div v-else-if="syncState.failedCount > 0" class="text-xs text-warning mt-0.5">
        Retry {{ syncState.failedCount }}/5
      </div>
    </div>

    <!-- Manual Sync Button -->
    <button v-if="canSync" @click="syncNow"
      class="flex-shrink-0 px-2.5 py-1 text-xs font-medium bg-accent-primary/10 text-accent-primary rounded hover:bg-accent-primary/20 transition-colors"
      title="Manually sync pending documents">
      Sync
    </button>

    <!-- Disabled State -->
    <div v-else class="flex-shrink-0 px-2.5 py-1 text-xs font-medium bg-slate-2/30 text-text-muted rounded opacity-50">
      Sync
    </div>
  </div>
</template>

<style scoped>
/* Pulsing animation for syncing state */
@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
