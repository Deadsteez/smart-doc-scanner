import { ref, readonly } from 'vue'
import { getSupabase } from '~/services/supabaseClient'

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: number | null
  nextRetryTime: number | null
  failedCount: number
  successCount: number
  errorMessage: string | null
}

const INITIAL_RETRY_DELAY = 5000       
const MAX_RETRY_DELAY = 5 * 60 * 1000 
const RETRY_MULTIPLIER = 1.5
const MAX_FAILED_COUNT = 5
const PERIODIC_SYNC_INTERVAL = 30000  

let retryDelay = INITIAL_RETRY_DELAY
let retryTimer: ReturnType<typeof setTimeout> | null = null
let periodicTimer: ReturnType<typeof setInterval> | null = null

const syncState = ref<SyncState>({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  lastSyncTime: null,
  nextRetryTime: null,
  failedCount: 0,
  successCount: 0,
  errorMessage: null,
})

async function syncPendingDocuments(): Promise<void> {
  const supabase = getSupabase()

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!session?.user) {
    console.log('[Sync] No authenticated user, skipping sync')
    return
  }

  const { data: pending, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('synced', false)

  if (fetchError) throw fetchError
  if (!pending || pending.length === 0) return

  for (const doc of pending) {
    const { error: updateError } = await supabase
      .from('documents')
      .update({ synced: true })
      .eq('id', doc.id)

    if (updateError) throw updateError
  }
}

function scheduleRetry(): void {
  if (syncState.value.failedCount >= MAX_FAILED_COUNT) {
    console.log('[Sync] Max retries reached, giving up')
    return
  }

  retryDelay = Math.min(retryDelay * RETRY_MULTIPLIER, MAX_RETRY_DELAY)
  const nextRetry = Date.now() + retryDelay

  syncState.value.nextRetryTime = nextRetry

  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    syncState.value.nextRetryTime = null
    syncNow()
  }, retryDelay)

  console.log(`[Sync] Scheduling retry in ${retryDelay}ms (attempt ${syncState.value.failedCount}/${MAX_FAILED_COUNT})`)
}

async function syncNow(): Promise<boolean> {
  if (!syncState.value.isOnline) {
    console.log('[Sync] Skipping sync — offline')
    return false
  }
  if (syncState.value.isSyncing) {
    console.log('[Sync] Skipping sync — already in progress')
    return false
  }

  console.log('[Sync] Starting sync of pending documents...')
  syncState.value.isSyncing = true
  syncState.value.errorMessage = null

  try {
    await syncPendingDocuments()

    syncState.value.lastSyncTime = Date.now()
    syncState.value.successCount++
    syncState.value.failedCount = 0
    syncState.value.nextRetryTime = null
    retryDelay = INITIAL_RETRY_DELAY

    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }

    console.log('[Sync] Sync completed successfully')
    return true
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown sync error'
    console.error('[Sync] Sync failed:', message)

    syncState.value.failedCount++
    syncState.value.errorMessage = message

    scheduleRetry()
    throw err 
  } finally {
    syncState.value.isSyncing = false
  }
}

function setupOnlineHandlers(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('online', () => {
    console.log('[Sync] Network connection restored')
    syncState.value.isOnline = true
    syncState.value.failedCount = 0
    syncState.value.nextRetryTime = null
    retryDelay = INITIAL_RETRY_DELAY

    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }

    syncNow()
  })

  window.addEventListener('offline', () => {
    console.log('[Sync] Network connection lost')
    syncState.value.isOnline = false
  })
}

function setupPeriodicSync(): void {
  if (periodicTimer) clearInterval(periodicTimer)

  periodicTimer = setInterval(() => {
    if (syncState.value.isOnline && !syncState.value.isSyncing) {
      syncNow()
    }
  }, PERIODIC_SYNC_INTERVAL)
}

async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.ready
    if ('sync' in registration) {
      // @ts-ignore – Background Sync API not yet in TypeScript lib
      await registration.sync.register('sync-unsynced-documents')
      console.log('[Sync] Background sync registered successfully')
    }
  } catch (err) {
    console.warn('[Sync] Background sync registration failed:', err)
  }
}

function getLastSyncDisplay(): string {
  if (!syncState.value.lastSyncTime) return ''

  const seconds = Math.floor((Date.now() - syncState.value.lastSyncTime) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function getRetryCountdown(): number {
  if (!syncState.value.nextRetryTime) return 0
  return Math.max(0, Math.ceil((syncState.value.nextRetryTime - Date.now()) / 1000))
}

function initialize(): () => void {
  console.log('[Sync] Initializing sync manager...')
  setupOnlineHandlers()
  setupPeriodicSync()
  registerBackgroundSync()

  if (syncState.value.isOnline) {
    syncNow()
  }

  return function cleanup() {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    if (periodicTimer) {
      clearInterval(periodicTimer)
      periodicTimer = null
    }
    console.log('[Sync] Sync manager cleaned up')
  }
}

export function useSyncManager() {
  return {
    syncState: readonly(syncState),
    syncNow,
    initialize,
    getLastSyncDisplay,
    getRetryCountdown,
  }
}