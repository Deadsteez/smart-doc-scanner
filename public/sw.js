
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-unsynced-documents') {
    console.log('[SW] Background sync triggered:', event.tag)
    event.waitUntil(syncUnsyncedDocuments())
  }
})

async function syncUnsyncedDocuments() {
  try {
    console.log('[SW] Starting background sync...')

    const clients = await self.clients.matchAll({ type: 'window' })

    if (clients.length === 0) {
      console.warn('[SW] No clients available to perform sync')
      throw new Error('No active clients')
    }

    
    const client = clients[0]
    console.log('[SW] Sending sync request to client:', client.id)

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel()

      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          console.log('[SW] Background sync completed:', event.data.message)
          resolve(event.data)
        } else {
          console.error('[SW] Background sync failed:', event.data.error)
          reject(new Error(event.data.error))
        }
      }

      client.postMessage(
        {
          type: 'BACKGROUND_SYNC_REQUEST',
          data: 'sync-unsynced-documents'
        },
        [messageChannel.port2]
      )

      
      setTimeout(() => {
        reject(new Error('Background sync timeout'))
      }, 30000)
    })
  } catch (err) {
    console.error('[SW] Background sync error:', err)
    throw err
  }
}

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data.type)

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting, activating immediately')
    self.skipWaiting()
  }
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    self.clients.claim()
  )
})

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  self.skipWaiting()
})
