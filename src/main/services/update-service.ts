import { app } from 'electron'
import electronUpdater from 'electron-updater'
import { Context, Effect, Layer, Schedule, SubscriptionRef } from 'effect'
import { messageOf, UpdateError } from '@shared/errors'
import type { UpdateStatus } from '@shared/schemas'

const firstCheckDelay = '10 seconds'
const checkInterval = '4 hours'

const make = Effect.gen(function* () {
  // electron-updater is CommonJS with getter exports that Node's ESM loader cannot name statically
  const { autoUpdater } = electronUpdater
  const supported = app.isPackaged
  const status = yield* SubscriptionRef.make<UpdateStatus>(supported ? { _tag: 'Idle' } : { _tag: 'Unsupported' })
  const set = (next: UpdateStatus) => Effect.runSync(SubscriptionRef.set(status, next))

  yield* Effect.acquireRelease(
    Effect.sync(() => {
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = true
      autoUpdater.on('checking-for-update', () => set({ _tag: 'Checking' }))
      autoUpdater.on('update-available', (info) => set({ _tag: 'Available', version: info.version }))
      autoUpdater.on('update-not-available', () => set({ _tag: 'NotAvailable' }))
      autoUpdater.on('download-progress', (info) => set({ _tag: 'Downloading', percent: info.percent }))
      autoUpdater.on('update-downloaded', (info) => set({ _tag: 'Downloaded', version: info.version }))
      autoUpdater.on('error', (error) => set({ _tag: 'Failed', message: messageOf(error) }))
    }),
    () => Effect.sync(() => autoUpdater.removeAllListeners()),
  )

  const check = Effect.gen(function* () {
    if (!supported) return yield* SubscriptionRef.get(status)
    yield* Effect.tryPromise({
      try: () => autoUpdater.checkForUpdates(),
      catch: (cause) => new UpdateError({ message: messageOf(cause) }),
    })
    return yield* SubscriptionRef.get(status)
  }).pipe(Effect.withSpan('UpdateService.check'))

  if (supported) {
    yield* check.pipe(
      Effect.catchTag('UpdateError', (error) => Effect.logWarning('Update check failed', error.message)),
      Effect.repeat(Schedule.spaced(checkInterval)),
      Effect.delay(firstCheckDelay),
      Effect.forkScoped,
    )
  }

  return {
    status: SubscriptionRef.get(status),
    /** Current status followed by every later change. */
    changes: SubscriptionRef.changes(status),
    check,
    /** Restarts into the downloaded update; a no-op until an update has been downloaded. */
    install: Effect.gen(function* () {
      if ((yield* SubscriptionRef.get(status))._tag !== 'Downloaded') return
      yield* Effect.try({
        try: () => autoUpdater.quitAndInstall(),
        catch: (cause) => new UpdateError({ message: messageOf(cause) }),
      })
    }),
  } as const
})

export class UpdateService extends Context.Service<UpdateService, Effect.Success<typeof make>>()('UpdateService', {
  make,
}) {}

export const UpdateServiceLive = Layer.effect(UpdateService, UpdateService.make)
