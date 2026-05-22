import { getSupabase } from '~/services/supabaseClient'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()

  const publicRoutes = ['/login', '/register', '/invite']

  // If not logged in, redirect to login (unless it's a public route)
  if (!data.session && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }

  // If logged in, redirect away from login/register
  const authRoutes = ['/login', '/register']
  if (data.session && authRoutes.includes(to.path)) {
    return navigateTo('/scan')
  }
})