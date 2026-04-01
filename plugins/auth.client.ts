// ~/plugins/auth.client.ts   ← .client suffix = browser only, never SSR
export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth()
  await initAuth()

  // Sync any pending documents that failed to upload previously
  const documentStore = useDocumentStore()
  await documentStore.syncPending()
})