import type { useSyncManager } from '~/composables/useSyncManager'

type SyncManager = ReturnType<typeof useSyncManager>

declare module '#app' {
  interface NuxtApp {
    $syncManager: SyncManager
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $syncManager: SyncManager
  }
}

export {}