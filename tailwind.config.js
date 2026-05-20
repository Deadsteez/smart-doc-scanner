/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./components/**/*.{vue,js,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue", // Added to ensure Nuxt error pages are covered
  ],
  theme: {
    extend: {
      fontFamily: {
        // Mapped to the CSS variables for a single source of truth
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* ─── Background Layers ─── */
        'bg-primary':   'var(--color-bg-primary)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-tertiary':  'var(--color-bg-tertiary)',
        'bg-elevated':  'var(--color-bg-elevated)',

        /* ─── Slate System ─── */
        'slate-1': 'var(--color-slate-1)',
        'slate-2': 'var(--color-slate-2)',
        'slate-3': 'var(--color-slate-3)',

        /* ─── Accent Colors ─── */
        'accent-primary':   'var(--color-accent-primary)',
        'accent-secondary': 'var(--color-accent-secondary)',
        'success':          'var(--color-success)',
        'warning':          'var(--color-warning)',
        'error':            'var(--color-error)',

        /* ─── Text Colors ─── */
        'text-primary':   'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted':     'var(--color-text-muted)',

        /* ─── Keep legacy primary for backward compat ─── */
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        /* ─── Refined to match DESIGN.md (softer, lower opacity) ─── */
        'glow-cyan':  '0 0 40px -10px rgba(14, 165, 233, 0.15)',
        'glow-teal':  '0 0 40px -10px rgba(20, 184, 166, 0.15)',
        'elevated':   '0 4px 20px -2px rgba(0, 0, 0, 0.15)',
        'card':       '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        /* ─── Timings tweaked for "Minimal Professional Motion" ─── */
        'spin':       'spin 1s linear infinite',
        'fade-in':    'fadeIn 0.2s ease-out', // Sped up slightly for a snappier feel
        'slide-up':   'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite', // Slowed down for calmer ambient effect
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.85' }, // Less aggressive dimming for readability
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}