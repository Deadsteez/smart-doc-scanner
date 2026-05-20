export default {
  darkMode: 'class',
  content: [
    "./components/**/*.{vue,js,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        /* ─── Background Layers ─── */
        'bg-primary':   '#0F172A',
        'bg-secondary': '#111827',
        'bg-tertiary':  '#1E293B',
        'bg-elevated':  '#243041',

        /* ─── Slate System ─── */
        'slate-1': '#334155',
        'slate-2': '#475569',
        'slate-3': '#64748B',

        /* ─── Accent Colors ─── */
        'accent-primary':   '#0EA5E9',
        'accent-secondary': '#14B8A6',
        'success':          '#10B981',
        'warning':          '#F59E0B',
        'error':            '#EF4444',

        /* ─── Text Colors ─── */
        'text-primary':   '#F8FAFC',
        'text-secondary': '#CBD5E1',
        'text-muted':     '#94A3B8',

        /* ─── Keep old primary for backward compat ─── */
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
        'glow-cyan':  '0 0 20px rgba(14, 165, 233, 0.15)',
        'glow-teal':  '0 0 20px rgba(20, 184, 166, 0.15)',
        'elevated':   '0 4px 24px rgba(0, 0, 0, 0.25)',
        'card':       '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'spin':       'spin 1s linear infinite',
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
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
          '50%':      { opacity: '0.7' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
