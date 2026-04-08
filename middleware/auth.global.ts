import { getSupabase } from '~/services/supabaseClient'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()

  const publicRoutes = ['/login', '/register']

  if (!data.session && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }

  if (data.session && publicRoutes.includes(to.path)) {
    return navigateTo('/scan')
  }
})