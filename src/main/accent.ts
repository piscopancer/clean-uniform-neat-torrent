import { systemPreferences } from 'electron'
import type { AccentColor } from '@shared/schemas'

/** OS accent as #rrggbb; Electron reports it as RRGGBBAA and only on Windows and macOS. */
export const readAccentColor = (): AccentColor =>
  process.platform === 'win32' || process.platform === 'darwin'
    ? `#${systemPreferences.getAccentColor().slice(0, 6).toLowerCase()}`
    : null
