import type { BrowserWindow } from 'electron'
import { Effect } from 'effect'
import { zoomRange } from '@shared/schemas'
import type { MainRuntime } from './runtime'
import { SettingsService } from './services/settings-service'
import { setMainWindowZoom } from './window'

type ZoomAction = 'in' | 'out' | 'reset'

const zoomStep = 0.1

/** Key codes rather than characters, so the shortcuts work on any keyboard layout and on the numpad. */
const zoomKeys: Readonly<Partial<Record<string, ZoomAction>>> = {
  Equal: 'in',
  NumpadAdd: 'in',
  Minus: 'out',
  NumpadSubtract: 'out',
  Digit0: 'reset',
  Numpad0: 'reset',
}

const nextFactor = (current: number, action: ZoomAction) => {
  if (action === 'reset') return 1
  const stepped = current + (action === 'in' ? zoomStep : -zoomStep)
  // rounding keeps repeated steps from drifting into values like 1.2000000000000002
  const rounded = Math.round(stepped * 100) / 100
  return Math.min(zoomRange.maximum, Math.max(zoomRange.minimum, rounded))
}

const applyZoom = (runtime: MainRuntime, action: ZoomAction) =>
  void runtime.runPromise(
    SettingsService.use((settings) =>
      settings.get.pipe(
        Effect.flatMap((current) => settings.update({ zoomFactor: nextFactor(current.zoomFactor, action) })),
        Effect.tap((next) => Effect.sync(() => setMainWindowZoom(next.zoomFactor))),
      ),
    ),
  )

/** Handles Ctrl with +, - and 0 and Ctrl with the mouse wheel, persisting the zoom so it survives a restart. */
export const watchZoom = (runtime: MainRuntime, window: BrowserWindow) => {
  const { webContents } = window
  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return
    const action = zoomKeys[input.code]
    if (action === undefined) return
    // also stops the default menu accelerators from zooming without saving
    event.preventDefault()
    applyZoom(runtime, action)
  })
  // Chromium reports Ctrl+wheel here instead of zooming by itself
  webContents.on('zoom-changed', (_, direction) => applyZoom(runtime, direction))
}
