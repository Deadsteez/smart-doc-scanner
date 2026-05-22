import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export const getSupabase = (): SupabaseClient => {
  if (import.meta.server) {
    throw new Error('[Supabase] getSupabase() must only be called client-side.')
  }

  if (client) return client


  const config = useRuntimeConfig()

  const supabaseUrl = config.public.supabaseUrl as string
  const supabaseAnonKey = config.public.supabaseAnonKey as string

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      '[Supabase] Missing credentials.\n' +
      'Ensure your .env has SUPABASE_URL and SUPABASE_ANON_KEY,\n' +
      'and nuxt.config.ts exposes them under runtimeConfig.public.'
    )
  }


  client = createClient(supabaseUrl, supabaseAnonKey,{
      auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  return client
}