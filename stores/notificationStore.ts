import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ApprovalStatus } from '~/types/workspace'

export interface AppNotification {
  id: string
  type: 'approval'
  title: string
  message: string
  status: ApprovalStatus
  document_id: string
  workspace_id: string
  timestamp: number
  read: boolean
}

const STORAGE_KEY = 'smartdoc_notifications'

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<AppNotification[]>([])

  function init() {
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) notifications.value = JSON.parse(stored)
      } catch {
      
      }
    }
  }

  function persist() {
    if (import.meta.client) {
     
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.value.slice(0, 50)))
    }
  }

  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.read).length
  )

  const sortedNotifications = computed(() =>
    [...notifications.value].sort((a, b) => b.timestamp - a.timestamp)
  )

  function push(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) {
    const newNotif: AppNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false,
    }
    notifications.value.unshift(newNotif)
    persist()
  }

  function markAllRead() {
    notifications.value.forEach(n => { n.read = true })
    persist()
  }

  function markRead(id: string) {
    const notif = notifications.value.find(n => n.id === id)
    if (notif) { notif.read = true; persist() }
  }

  function clear() {
    notifications.value = []
    if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
  }

  function removeById(id: string) {
    notifications.value = notifications.value.filter(n => n.id !== id)
    persist()
  }

  return {
    notifications,
    unreadCount,
    sortedNotifications,
    init,
    push,
    markAllRead,
    markRead,
    clear,
    removeById,
  }
})
