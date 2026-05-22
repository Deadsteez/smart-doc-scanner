import { ref } from 'vue'
import { getSupabase } from '~/services/supabaseClient'
import type { User } from '@supabase/supabase-js'

const user = ref<User | null>(null)
const initialized = ref(false)

export const useAuth = () => {
  const initAuth = async () => {
    if (initialized.value) return

    const supabase = getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null

    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
    })

    initialized.value = true
  }

  const register = async (email: string, password: string) => {
    return getSupabase().auth.signUp({ email, password })
  }

  const login = async (email: string, password: string) => {
    return getSupabase().auth.signInWithPassword({ email, password })
  }

  const logout = async () => {
    return getSupabase().auth.signOut()
  }

  const getUser = async () => {
    const { data } = await getSupabase().auth.getUser()
    return data.user
  }

  return { user, register, login, logout, getUser, initAuth }
}