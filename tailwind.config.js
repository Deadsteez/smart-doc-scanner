/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./components/**/*.{vue,js,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./app.vue",
    "./error.vue",
  ],
  theme: {
    extend: {
      fontFamily: {

        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {

        'bg-primary': 'var(--color-bg-primary)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-tertiary': 'var(--color-bg-tertiary)',
        'bg-elevated': 'var(--color-bg-elevated)',


        'slate-1': 'var(--color-slate-1)',
        'slate-2': 'var(--color-slate-2)',
        'slate-3': 'var(--color-slate-3)',

        'accent-primary': 'var(--color-accent-primary)',
        'accent-secondary': 'var(--color-accent-secondary)',
        'success': 'var(--color-success)',
        'warning': 'var(--color-warning)',
        'error': 'var(--color-error)',


        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',


        primary: {
          50: '#eff6ff',
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
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {

        'glow-cyan': '0 0 40px -10px rgba(14, 165, 233, var(--shadow-glow-opacity, 0.2))',
        'glow-teal': '0 0 40px -10px rgba(20, 184, 166, var(--shadow-glow-opacity, 0.2))',
        'elevated': 'var(--shadow-elevated, 0 4px 20px -2px rgba(0,0,0,0.15))',
        'card': 'var(--shadow-card-base, 0 1px 3px rgba(0,0,0,0.1))',
        'card-hover': 'var(--shadow-card-hover, 0 10px 25px -5px rgba(0,0,0,0.1))',
      },
      animation: {

        'spin': 'spin 1s linear infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}