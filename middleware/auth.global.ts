import { getSupabase } from '~/services/supabaseClient'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const supabase = getSupabase()

  const { data: { session } } = await supabase.auth.getSession()

  const unauthenticatedAllowed = ['/login', '/register', '/invite', '/eval']
  const guestOnlyRoutes = ['/login', '/register']

  if (!session && !unauthenticatedAllowed.includes(to.path)) {
    return navigateTo('/login')
  }

  if (session && guestOnlyRoutes.includes(to.path)) {
    return navigateTo('/scan')
  }

  if (session) {
    supabase.auth.getUser().catch(() => {
      // Token invalid or revoked — sign out and redirect
      supabase.auth.signOut()
      navigateTo('/login')
    })
  }
})