import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  devtools: { enabled: process.env.NODE_ENV === 'development' },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/color-mode', '@pinia/nuxt', '@vite-pwa/nuxt', 'nuxt-security'],
  css: ['~/assets/main.css'],

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
        ...(process.env.NODE_ENV !== 'production'
          ? [{ name: 'robots', content: 'noindex,nofollow' }]
          : [])
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

  // @ts-ignore
nitro: {
  preset: 'node-server',
},

// @ts-ignore
routeRules: {
  '/invite/**': { ssr: false },
  '/workspace/**': { ssr: false },
  '/dashboard': { ssr: false },
  '/scan': { ssr: false },
  '/profile': { ssr: false },
  '/doc/**': { ssr: false },
  '/eval': { ssr: false },
},

  security: {
    nonce: true,
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'strict-dynamic'", "'nonce-{{nonce}}'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          `https://${process.env.NUXT_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? 'YOUR_PROJECT.supabase.co'}`
        ],
        'connect-src': [
          "'self'",
          `https://${process.env.NUXT_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? 'YOUR_PROJECT.supabase.co'}`,
          `wss://${process.env.NUXT_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? 'YOUR_PROJECT.supabase.co'}`
        ],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
        'worker-src': ["'self'"],
        'upgrade-insecure-requests': true
      },
      crossOriginEmbedderPolicy: false,
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: {
        camera: ['self'],
        microphone: [],
        geolocation: []
      },
      strictTransportSecurity: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubdomains: true, preload: true }
        : false
    },
    rateLimiter: {
      tokensPerInterval: 150,
      interval: 'hour'
    }
  },

  runtimeConfig: {
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
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ico}'],
      globIgnores: ['**/opencv.js'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/render\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'supabase-media-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 7
            },
            cacheableResponse: { statuses: [0, 200] }
          }
        },
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-api-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 5
            },
            cacheableResponse: { statuses: [0, 200] }
          }
        }
      ]
    },
    devOptions: {
      enabled: process.env.NODE_ENV === 'development',
      type: 'module'
    }
  },

  vite: {
    worker: { format: 'es' }
  },

  compatibilityDate: '2024-11-01',
})