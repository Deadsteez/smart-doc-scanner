import { useSyncManager } from '~/composables/useSyncManager'
import { useAuth } from '~/composables/useAuth'

export default defineNuxtPlugin({
  name: 'sync-manager',
  enforce: 'post',
  async setup(nuxtApp) {
    if (process.server) return

    const { initAuth } = useAuth()
    await initAuth()

    const syncManager = useSyncManager()
    const cleanup = syncManager.initialize()

    nuxtApp.provide('syncManager', syncManager)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[App] Message from SW:', event.data.type)

        if (event.data.type === 'BACKGROUND_SYNC_REQUEST') {
          console.log('[App] Background sync requested by service worker')

          syncManager.syncNow()
            .then((didSync) => {
              console.log(
                didSync
                  ? '[App] Background sync completed, sending response to SW'
                  : '[App] Background sync skipped (offline or already running), notifying SW'
              )
              event.ports?.[0]?.postMessage({
                success: true,
                synced: didSync,
                message: didSync ? 'Sync completed' : 'Sync skipped',
                timestamp: Date.now(),
              })
            })
            .catch((err) => {
              console.error('[App] Background sync failed, sending error to SW:', err)
              event.ports?.[0]?.postMessage({
                success: false,
                synced: false,
                error: err?.message || 'Sync failed',
                timestamp: Date.now(),
              })
            })
        }
      })
    }
    nuxtApp.vueApp.onUnmount(cleanup)
  },
})