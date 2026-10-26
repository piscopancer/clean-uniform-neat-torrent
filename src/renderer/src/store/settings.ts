import { create } from 'zustand'
import type { Output } from '@/lib/api'

export type SettingsValue = Output<'settings.get'>

/** Settings mirrored from main; null until the first load completes. */
export const useSettings = create<{ readonly settings: SettingsValue | null }>(() => ({ settings: null }))

export const setSettings = (settings: SettingsValue) => useSettings.setState({ settings })

export const useDownloadFolder = () => useSettings((state) => state.settings?.downloadFolder ?? '')

/** Theme preference; dark until settings load, matching the default. */
export const useThemePreference = () => useSettings((state) => state.settings?.theme ?? 'dark')

/** Whether highlights follow the OS accent colour; off until settings load, matching the default. */
export const useSystemAccent = () => useSettings((state) => state.settings?.useSystemAccent ?? false)

/** Torrent list layout; table until settings load, matching the default. */
export const useTorrentView = () => useSettings((state) => state.settings?.torrentView ?? 'table')

/** Span of the speed chart; ten minutes until settings load, matching the default. */
export const useSpeedRange = () => useSettings((state) => state.settings?.speedRange ?? '10m')
