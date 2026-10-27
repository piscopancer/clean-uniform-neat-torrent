import { join } from 'node:path'
import { app, nativeTheme } from 'electron'
import { Context, Effect, Layer, Schema, SubscriptionRef } from 'effect'
import { Settings, SettingsPatch } from '@shared/schemas'
import { ensureDirectory, readJsonFile, writeJsonFile } from '../lib/fs'

const defaults = (): Settings => ({
  downloadFolder: app.getPath('downloads'),
  downloadLimit: null,
  uploadLimit: null,
  startMinimized: false,
  launchOnStartup: false,
  theme: 'dark',
  zoomFactor: 1,
  torrentView: 'table',
  speedRange: '10m',
  useSystemAccent: false,
  extraVisuals: false,
  groupByStatus: false,
})

/** The settings file as it may be stored, including keys of earlier versions under their old names. */
const StoredSettings = Schema.Struct({
  ...SettingsPatch.fields,
  /** Name of extraVisuals up to 0.3.0. */
  enhancedVisuals: Schema.optionalKey(Schema.Boolean),
})

/** Moves keys of earlier versions to their current names; a current key wins over an old one. */
const migrate = ({ enhancedVisuals, ...patch }: typeof StoredSettings.Type): SettingsPatch => ({
  ...(enhancedVisuals === undefined ? {} : { extraVisuals: enhancedVisuals }),
  ...patch,
})

/** Applies the settings that live outside the app: native theme and the OS login item. */
const applyToSystem = (settings: Settings) =>
  Effect.sync(() => {
    nativeTheme.themeSource = settings.theme
    // registering the dev Electron binary as a login item would launch a bare Electron at boot
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.launchOnStartup })
  })

const make = Effect.gen(function* () {
  const file = join(app.getPath('userData'), 'settings.json')
  // the file is decoded as a patch so a missing or newly added key falls back to its default
  const stored = yield* readJsonFile(file, StoredSettings).pipe(
    Effect.map((settings) => settings && migrate(settings)),
    Effect.catchTag('PersistenceError', (error) =>
      Effect.logWarning('Settings file is unreadable, using defaults', error.message).pipe(Effect.as(null)),
    ),
  )
  const ref = yield* SubscriptionRef.make<Settings>({ ...defaults(), ...stored })
  yield* applyToSystem(yield* SubscriptionRef.get(ref))

  const update = Effect.fn('SettingsService.update')(function* (patch: SettingsPatch) {
    if (patch.downloadFolder !== undefined) yield* ensureDirectory(patch.downloadFolder)
    return yield* SubscriptionRef.updateAndGetEffect(ref, (current) => {
      const next: Settings = { ...current, ...patch }
      return writeJsonFile(file, Settings, next).pipe(Effect.andThen(applyToSystem(next)), Effect.as(next))
    })
  })

  return {
    get: SubscriptionRef.get(ref),
    update,
    /** Current settings followed by every later change. */
    changes: SubscriptionRef.changes(ref),
  } as const
})

export class SettingsService extends Context.Service<SettingsService, Effect.Success<typeof make>>()(
  'SettingsService',
  { make },
) {}

export const SettingsServiceLive = Layer.effect(SettingsService, SettingsService.make)
