import { Notification, systemPreferences } from 'electron'
import { Effect, Layer, Stream } from 'effect'
import { Broadcaster } from './broadcaster'
import { TorrentService } from './torrent-service'
import { UpdateService } from './update-service'
import { readAccentColor } from '../accent'
import { showMainWindow } from '../window'

/** Forwards service streams to the renderer and the OS for as long as the runtime lives. */
export const BridgeLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const broadcaster = yield* Broadcaster
    const torrents = yield* TorrentService
    const updates = yield* UpdateService

    yield* torrents.progress.pipe(
      Stream.runForEach((snapshot) => broadcaster.send('progress', snapshot)),
      Effect.forkScoped,
    )
    yield* torrents.completions.pipe(
      Stream.runForEach((completed) =>
        Effect.sync(() => {
          if (Notification.isSupported()) {
            const notification = new Notification({ title: 'Download complete', body: completed.name })
            notification.on('click', showMainWindow)
            notification.show()
          }
        }).pipe(Effect.andThen(broadcaster.send('torrentCompleted', completed))),
      ),
      Effect.forkScoped,
    )
    yield* updates.changes.pipe(
      Stream.runForEach((status) => broadcaster.send('updateStatus', status)),
      Effect.forkScoped,
    )
    // only Windows reports accent changes; macOS picks up a new accent on the next launch
    const onAccentChange = () => void Effect.runFork(broadcaster.send('accentColor', readAccentColor()))
    yield* Effect.acquireRelease(
      Effect.sync(() => systemPreferences.on('accent-color-changed', onAccentChange)),
      () => Effect.sync(() => systemPreferences.off('accent-color-changed', onAccentChange)),
    )
  }),
)
