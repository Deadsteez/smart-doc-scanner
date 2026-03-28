// ~/plugins/auth.client.ts   ← .client suffix = browser only, never SSR
export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth()
  await initAuth()
})