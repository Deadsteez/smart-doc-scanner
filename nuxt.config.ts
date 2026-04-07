// @ts-ignore - PWA module types
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/color-mode','@pinia/nuxt','@vite-pwa/nuxt'],

  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
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
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? '',
     supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    }
  },

  pwa: {
  registerType: 'autoUpdate',
  manifest: {
    name: 'SmartDoc Scanner',
    short_name: 'SmartScan',
    description: 'AI-powered document scanner and manager',
    theme_color: '#000000',
    background_color: '#000000',
    display: 'standalone',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  },
  workbox: {
    navigateFallback: '/',
    globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'supabase-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 // 24 hours
          }
        }
      }
    ]
  },
  devOptions: {
    enabled: true,
    type: 'module'
  }
},

  vite: {
    worker: {
      format: 'es'
    }},
  compatibilityDate: '2024-11-01',
})
