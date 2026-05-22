<script setup lang="ts">
import { ref } from 'vue'
import { useNotificationStore } from '~/stores/notificationStore'
import { onClickOutside } from '@vueuse/core'

const notificationStore = useNotificationStore()
const isOpen = ref(false)
const bellRef = ref(null)

onClickOutside(bellRef, () => { isOpen.value = false })

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) notificationStore.markAllRead()
}

const statusColors: Record<string, string> = {
  approved: 'text-success',
  rejected: 'text-error',
  pending: 'text-warning',
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
</script>

<template>
  <div class="relative" ref="bellRef">
    <!-- Bell Button -->
    <button
      id="notification-bell-btn"
      @click="toggle"
      class="relative p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/40 transition-colors"
      aria-label="Notifications"
    >
      <!-- Bell icon -->
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>

      <!-- Unread badge -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="scale-0 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-0 opacity-0"
      >
        <span
          v-if="notificationStore.unreadCount > 0"
          class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-accent-primary rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none"
        >
          {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
        </span>
      </Transition>
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
        v-if="isOpen"
        id="notification-dropdown"
        class="absolute right-0 top-[calc(100%+0.75rem)] w-80 rounded-2xl overflow-hidden shadow-elevated bg-bg-elevated border border-slate-1/50 z-50"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-1/30">
          <h3 class="text-sm font-semibold text-text-primary">Notifications</h3>
          <button
            v-if="notificationStore.notifications.length > 0"
            @click="notificationStore.clear()"
            class="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Clear all
          </button>
        </div>

        <!-- Notification list -->
        <div class="max-h-80 overflow-y-auto">
          <div
            v-if="notificationStore.sortedNotifications.length === 0"
            class="py-10 text-center"
          >
            <svg class="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p class="text-xs text-text-muted">No notifications yet</p>
          </div>

          <div
            v-for="notif in notificationStore.sortedNotifications"
            :key="notif.id"
            class="flex items-start gap-3 px-4 py-3 hover:bg-bg-tertiary/30 transition-colors border-b border-slate-1/10 last:border-b-0"
          >
            <!-- Status dot -->
            <div class="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
              :class="{
                'bg-success': notif.status === 'approved',
                'bg-error': notif.status === 'rejected',
                'bg-warning': notif.status === 'pending',
                'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]': notif.type === 'member_joined',
              }"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium" 
                 :class="notif.type === 'member_joined' ? 'text-sky-400' : (statusColors[notif.status ?? ''] || 'text-text-primary')">
                {{ notif.title }}
              </p>
              <p class="text-xs text-text-muted mt-0.5 line-clamp-2">{{ notif.message }}</p>
              <p class="text-xs text-text-muted/60 mt-1">{{ formatTime(notif.timestamp) }}</p>
            </div>
            <button
              @click.stop="notificationStore.removeById(notif.id)"
              class="text-text-muted/40 hover:text-text-muted transition-colors flex-shrink-0"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

