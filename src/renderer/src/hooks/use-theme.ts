import { useEffect, useSyncExternalStore } from 'react'
import { useThemePreference } from '@/store/settings'

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

const subscribeSystem = (onChange: () => void) => {
  darkQuery.addEventListener('change', onChange)
  return () => darkQuery.removeEventListener('change', onChange)
}

const systemPrefersDark = () => darkQuery.matches

/** Resolves the theme preference against the OS and toggles the `dark` class on the root element. */
export const useTheme = () => {
  const preference = useThemePreference()
  const systemDark = useSyncExternalStore(subscribeSystem, systemPrefersDark)
  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])
  return resolved
}
