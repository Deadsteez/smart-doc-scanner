// ~/composables/useAuth.ts
import { ref } from 'vue'
import { getSupabase } from '~/services/supabaseClient'

// Defined outside the function so state is shared across all useAuth() calls
const user = ref(null)

export const useAuth = () => {
  const supabase = getSupabase()

  // Call this once on app startup to rehydrate session after refresh
  const initAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null

    // Keeps user in sync on token refresh, logout from another tab, etc.
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