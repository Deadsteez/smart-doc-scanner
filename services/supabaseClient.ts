import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export const getSupabase = (): SupabaseClient => {
  if (_client) return _client

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

  _client = createClient(supabaseUrl, supabaseAnonKey)
  return _client
}