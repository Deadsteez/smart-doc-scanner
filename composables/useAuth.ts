
import { getSupabase} from '~/services/supabaseClient';

export const useAuth = () => {
  const supabase=getSupabase()
  const register = async (email: string, password: string) => {
    return await supabase.auth.signUp({
      email,
      password
    })
  }

  const login = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({
      email,
      password
    })
  }

  const logout = async () => {
    return await supabase.auth.signOut()
  }

  const getUser = async () => {
    const { data } = await supabase.auth.getUser()
    return data.user
  }

  return { register, login, logout, getUser }
}
