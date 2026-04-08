import { computed } from 'vue'

export function useTheme() {
  const colorMode = useColorMode()
  const isDark = computed(() => colorMode.value === 'dark')

  const toggle = () => {
    colorMode.preference = isDark.value ? 'light' : 'dark'
  }

  return { isDark, toggle, colorMode }
}