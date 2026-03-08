
import {getSupabase} from '~/services/supabaseClient'

export default defineNuxtRouteMiddleware(async () => {
  const supabase=getSupabase()
  const { data } = await supabase.auth.getSession()

  if (!data.session) {
    return navigateTo('/login')
  }
})
