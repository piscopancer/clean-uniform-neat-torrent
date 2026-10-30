import { stat, writeFile } from 'node:fs/promises'
import { app, BrowserWindow, dialog, shell, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { Effect } from 'effect'
import type { CommandInput, CommandName, CommandOutput } from '@shared/contract'
import { messageOf, PersistenceError, TorrentEngineError, type IpcError } from '@shared/errors'
import { readAccentColor } from '../accent'
import { launchQueue } from '../launch-args'
import type { MainServices } from '../runtime'
import { SettingsService } from '../services/settings-service'
import { SpeedHistory } from '../services/speed-history'
import { inspectTorrentFile, TorrentService } from '../services/torrent-service'
import { UpdateService } from '../services/update-service'

/** One handler per contract command; a missing or mistyped handler is a compile error. */
type Handlers = {
  readonly [K in CommandName]: (input: CommandInput<K>) => Effect.Effect<CommandOutput<K>, IpcError, MainServices>
}

const showOpenDialog = (options: OpenDialogOptions) =>
  Effect.promise(() => {
    const window = BrowserWindow.getFocusedWindow()
    return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options)
  })

const showSaveDialog = (options: SaveDialogOptions) =>
  Effect.promise(() => {
    const window = BrowserWindow.getFocusedWindow()
    return window ? dialog.showSaveDialog(window, options) : dialog.showSaveDialog(options)
  })

/** Replaces characters that Windows forbids in file names, so a torrent name can serve as one. */
const toFileName = (name: string) => name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim() || 'torrent'

const exists = (path: string) =>
  Effect.promise(() =>
    stat(path).then(
      () => true,
      () => false,
    ),
  )

export const handlers: Handlers = {
  'torrents.list': () => TorrentService.use((torrents) => torrents.list),
  'torrents.addMagnet': ({ magnet, savePath }) =>
    TorrentService.use((torrents) => torrents.addMagnet(magnet, savePath)),
  'torrents.addFile': ({ path, savePath, selected }) =>
    TorrentService.use((torrents) => torrents.addFile(path, savePath, selected)),
  'torrents.inspectFile': ({ path }) => inspectTorrentFile(path),
  'torrents.pause': ({ infoHashes }) => TorrentService.use((torrents) => torrents.pause(infoHashes)),
  'torrents.resume': ({ infoHashes }) => TorrentService.use((torrents) => torrents.resume(infoHashes)),
  'torrents.remove': ({ infoHashes, deleteFiles }) =>
    TorrentService.use((torrents) => torrents.remove(infoHashes, deleteFiles)),
  'torrents.details': ({ infoHash }) => TorrentService.use((torrents) => torrents.details(infoHash)),
  'torrents.selectFiles': ({ infoHash, selected }) =>
    TorrentService.use((torrents) => torrents.selectFiles(infoHash, selected)),
  'torrents.setLimits': ({ infoHashes, ...limits }) =>
    TorrentService.use((torrents) => torrents.setLimits(infoHashes, limits)),
  'torrents.speedHistory': ({ infoHash }) => SpeedHistory.use((history) => history.of(infoHash)),
  'torrents.openFolder': ({ infoHash }) =>
    Effect.gen(function* () {
      const path = yield* TorrentService.use((torrents) => torrents.contentPath(infoHash))
      if (yield* exists(path)) return shell.showItemInFolder(path)
      const { savePath } = (yield* TorrentService.use((torrents) => torrents.details(infoHash))).summary
      yield* Effect.promise(() => shell.openPath(savePath))
    }),
  'torrents.exportFile': ({ infoHash }) =>
    Effect.gen(function* () {
      const { name, bytes } = yield* TorrentService.use((torrents) => torrents.torrentFile(infoHash))
      if (bytes === null) return yield* new TorrentEngineError({ message: 'Metadata has not arrived yet' })
      const { canceled, filePath } = yield* showSaveDialog({
        title: 'Export torrent file',
        defaultPath: `${toFileName(name)}.torrent`,
        filters: [{ name: 'Torrent files', extensions: ['torrent'] }],
      })
      if (canceled || filePath === '') return false
      yield* Effect.tryPromise({
        try: () => writeFile(filePath, bytes),
        catch: (cause) => new PersistenceError({ file: filePath, message: messageOf(cause) }),
      })
      return true
    }),
  'dialog.openTorrentFile': () =>
    showOpenDialog({
      title: 'Open torrent file',
      properties: ['openFile'],
      filters: [{ name: 'Torrent files', extensions: ['torrent'] }],
    }).pipe(Effect.map((result) => (result.canceled ? null : (result.filePaths[0] ?? null)))),
  'dialog.pickFolder': ({ defaultPath }) =>
    showOpenDialog({
      title: 'Choose download folder',
      properties: ['openDirectory', 'createDirectory'],
      ...(defaultPath === undefined ? {} : { defaultPath }),
    }).pipe(Effect.map((result) => (result.canceled ? null : (result.filePaths[0] ?? null)))),
  'settings.get': () => SettingsService.use((settings) => settings.get),
  'settings.update': (patch) => SettingsService.use((settings) => settings.update(patch)),
  'app.version': () => Effect.sync(() => app.getVersion()),
  'updates.status': () => UpdateService.use((updates) => updates.status),
  'updates.check': () => UpdateService.use((updates) => updates.check),
  'updates.install': () => UpdateService.use((updates) => updates.install),
  'system.accentColor': () => Effect.sync(readAccentColor),
  'launch.take': () => Effect.sync(launchQueue.take),
}
