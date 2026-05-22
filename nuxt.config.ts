// @ts-ignore - PWA module types
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/color-mode','@pinia/nuxt','@vite-pwa/nuxt'],

  colorMode: {
    classSuffix: '',
    preference: 'dark',
    fallback: 'dark',
    storageKey: 'nuxt-color-mode'
  },

  app: {
    head: {
      title: 'SmartDoc Scanner — Intelligent Document Workspace',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'AI-powered document scanner and intelligent financial workspace. Scan, extract, classify, and manage documents effortlessly.' },
        { name: 'theme-color', content: '#0F172A' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap',
        },
      ],
    }
  },

 runtimeConfig: {
    // Server-side only (never exposed to client)
    inviteSecret: process.env.INVITE_SECRET ?? '',
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    }
  },

  pwa: {
  registerType: 'autoUpdate',
  manifest: {
    name: 'SmartDoc Scanner',
    short_name: 'SmartScan',
    description: 'AI-powered document scanner and manager',
    theme_color: '#0F172A',
    background_color: '#0F172A',
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
            maxAgeSeconds: 60 * 60 * 24 
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
