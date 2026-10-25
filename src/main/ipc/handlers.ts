import { stat } from 'node:fs/promises'
import { app, BrowserWindow, dialog, shell, type OpenDialogOptions } from 'electron'
import { Effect } from 'effect'
import type { CommandInput, CommandName, CommandOutput } from '@shared/contract'
import type { IpcError } from '@shared/errors'
import { readAccentColor } from '../accent'
import type { MainServices } from '../runtime'
import { SettingsService } from '../services/settings-service'
import { TorrentService } from '../services/torrent-service'
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
  'torrents.addFile': ({ path, savePath }) => TorrentService.use((torrents) => torrents.addFile(path, savePath)),
  'torrents.pause': ({ infoHashes }) => TorrentService.use((torrents) => torrents.pause(infoHashes)),
  'torrents.resume': ({ infoHashes }) => TorrentService.use((torrents) => torrents.resume(infoHashes)),
  'torrents.remove': ({ infoHashes, deleteFiles }) =>
    TorrentService.use((torrents) => torrents.remove(infoHashes, deleteFiles)),
  'torrents.details': ({ infoHash }) => TorrentService.use((torrents) => torrents.details(infoHash)),
  'torrents.selectFiles': ({ infoHash, selected }) =>
    TorrentService.use((torrents) => torrents.selectFiles(infoHash, selected)),
  'torrents.openFolder': ({ infoHash }) =>
    Effect.gen(function* () {
      const path = yield* TorrentService.use((torrents) => torrents.contentPath(infoHash))
      if (yield* exists(path)) return shell.showItemInFolder(path)
      const { savePath } = (yield* TorrentService.use((torrents) => torrents.details(infoHash))).summary
      yield* Effect.promise(() => shell.openPath(savePath))
    }),
  'dialog.openTorrentFiles': () =>
    showOpenDialog({
      title: 'Open torrent files',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Torrent files', extensions: ['torrent'] }],
    }).pipe(Effect.map((result) => (result.canceled ? [] : result.filePaths))),
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
}
