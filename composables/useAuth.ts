import { ref } from 'vue'
import { getSupabase } from '~/services/supabaseClient'
import type { User } from '@supabase/supabase-js'

const user = ref<User | null>(null)

export const useAuth = () => {
  const supabase = getSupabase()
  const initAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null

    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
    })
  }

  const register = async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password })
  }

  const login = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const logout = async () => {
    return await supabase.auth.signOut()
  }

  const getUser = async () => {
    const { data } = await supabase.auth.getUser()
    return data.user
  }

  return { user, register, login, logout, getUser, initAuth }
}