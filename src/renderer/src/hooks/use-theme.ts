import { useLayoutEffect, useSyncExternalStore } from 'react'
import { useThemePreference } from '@/store/settings'

/** Disables transitions while the theme class changes; styled in index.css. */
const switchingClass = 'theme-switching'

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
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add(switchingClass)
    root.classList.toggle('dark', resolved === 'dark')
    // reading a computed style applies the new colours while transitions are still off
    void getComputedStyle(root).color
    const frame = requestAnimationFrame(() => root.classList.remove(switchingClass))
    return () => cancelAnimationFrame(frame)
  }, [resolved])
  return resolved
}
