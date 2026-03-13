import { computed } from 'vue'

export function useTheme() {
  // useColorMode is auto-imported by the @nuxtjs/color-mode module
  const colorMode = useColorMode()

  // `computed` must be explicitly imported in plain .ts files.
  // It's only auto-imported inside <script setup> blocks.
  const isDark = computed(() => colorMode.value === 'dark')

  const toggle = () => {
    colorMode.preference = isDark.value ? 'light' : 'dark'
  }

  return { isDark, toggle, colorMode }
}