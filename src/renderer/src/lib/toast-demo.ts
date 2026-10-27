import type { IpcErrorEncoded, IpcErrorTag } from '@shared/errors'
import { ToastFlag, toastEnv } from '@shared/toast-flag'
import { Schema } from 'effect'
import { toasts } from './toasts'

/** Whether the dev script was started with --toast=test; builds ignore the flag. */
export const toastDemo = import.meta.env.DEV && Schema.is(ToastFlag)(import.meta.env[toastEnv])

const name = 'Fallout.New.Vegas.Ultimate.Edition.GOG'
const infoHash = '6a9759bffd5c0af65319979fb7832189f4f3c35d'

/** One made-up error per tag, so a new error tag fails to compile until the demo covers it. */
const errors: { readonly [T in IpcErrorTag]: Extract<IpcErrorEncoded, { readonly _tag: T }> } = {
  InvalidMagnetError: { _tag: 'InvalidMagnetError', magnet: 'magnet:?xt=urn:btih:broken' },
  InvalidTorrentFileError: {
    _tag: 'InvalidTorrentFileError',
    path: 'C:\\Users\\demo\\Downloads\\broken.torrent',
    reason: 'Invalid bencode',
  },
  DuplicateTorrentError: { _tag: 'DuplicateTorrentError', infoHash, name },
  TorrentNotFoundError: { _tag: 'TorrentNotFoundError', infoHash },
  SaveFolderMissingError: { _tag: 'SaveFolderMissingError', path: 'D:\\Torrents\\Games' },
  TorrentEngineError: { _tag: 'TorrentEngineError', message: 'Port 6881 is already in use' },
  PersistenceError: { _tag: 'PersistenceError', file: 'session.json', message: 'EBUSY: resource busy or locked' },
  UpdateError: { _tag: 'UpdateError', message: 'net::ERR_INTERNET_DISCONNECTED' },
  InvalidInputError: { _tag: 'InvalidInputError', command: 'torrents.addMagnet', message: 'Expected a string' },
  UnexpectedError: { _tag: 'UnexpectedError', message: 'Cannot read properties of undefined' },
}

/** Every toast of the app with made-up data; the update prompt's Restart does nothing here. */
const demos: ReadonlyArray<() => void> = [
  () => toasts.downloadComplete(name),
  () => toasts.copied('Info hash'),
  () => toasts.copied('Magnet link'),
  () => toasts.added(name),
  () => toasts.addedMany(3),
  () => toasts.exported(),
  () => toasts.updateReady('9.9.9', () => {}),
  ...Object.values(errors).map((error) => () => toasts.error(error)),
]

export const showRandomToast = () => demos[Math.floor(Math.random() * demos.length)]?.()
