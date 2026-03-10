
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/color-mode','@pinia/nuxt',],

  colorMode: {
    classSuffix: '',
    preference: 'dark',
    fallback: 'dark',
    storageKey: 'nuxt-color-mode'
  },

  app: {
    head: {
      title: 'Document Scanner',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

 runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    }
  },

  vite: {
    worker: {
      format: 'es'
    }},
  compatibilityDate: '2024-11-01',
})
