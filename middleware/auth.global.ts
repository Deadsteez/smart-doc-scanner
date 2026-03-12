// ~/middleware/auth.global.ts
import { getSupabase } from '~/services/supabaseClient'

export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()

  const publicRoutes = ['/login', '/register']

  // Not logged in and trying to access protected route → go to login
  if (!data.session && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }

  // Already logged in and hitting login/register → go to app
  if (data.session && publicRoutes.includes(to.path)) {
    return navigateTo('/scan')
  }
})