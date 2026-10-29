import type { CommandArgs, CommandName } from '@shared/contract'
import { openDialog, queueDialogs, type Dialog } from '@/store/dialogs'
import { setSettings } from '@/store/settings'
import { applySnapshot } from '@/store/torrents'
import { setAppVersion, setUpdateStatus, type UpdateStatusValue } from '@/store/updates'
import { run, type InfoHash } from './api'
import { toasts } from './toasts'

/** Pulls a fresh snapshot so the UI reflects a command without waiting for the next progress tick. */
export const refresh = async () => {
  const result = await run('torrents.list')
  if (result.ok) applySnapshot(result.value)
}

export const loadSettings = async () => {
  const result = await run('settings.get')
  if (result.ok) setSettings(result.value)
}

const mutate = async <K extends CommandName>(name: K, ...args: CommandArgs<K>) => {
  const result = await run(name, ...args)
  if (result.ok) await refresh()
  return result
}

/** Omits an empty folder so main falls back to the default download folder. */
const withSavePath = (savePath: string) => (savePath === '' ? {} : { savePath })

export const addMagnet = async (magnet: string, savePath = '') => {
  const result = await mutate('torrents.addMagnet', { magnet: magnet.trim(), ...withSavePath(savePath) })
  if (result.ok) toasts.added(result.value.name)
  return result.ok
}

/** Adds one .torrent file, downloading only the `selected` file indices when given. */
export const addFile = async (path: string, savePath = '', selected?: ReadonlyArray<number>) => {
  const result = await mutate('torrents.addFile', {
    path,
    ...withSavePath(savePath),
    ...(selected === undefined ? {} : { selected }),
  })
  if (result.ok) toasts.added(result.value.name)
  return result.ok
}

/** Adds each file in turn so one bad file does not block the rest; returns how many were added. */
export const addFiles = async (paths: ReadonlyArray<string>, savePath = '') => {
  let added = 0
  for (const path of paths) {
    const result = await mutate('torrents.addFile', { path, ...withSavePath(savePath) })
    if (result.ok) added += 1
  }
  if (added > 0) toasts.addedMany(added)
  return added
}

export const pause = (infoHashes: ReadonlyArray<InfoHash>) => mutate('torrents.pause', { infoHashes })

export const resume = (infoHashes: ReadonlyArray<InfoHash>) => mutate('torrents.resume', { infoHashes })

export const remove = (infoHashes: ReadonlyArray<InfoHash>, deleteFiles: boolean) =>
  mutate('torrents.remove', { infoHashes, deleteFiles })

export const openFolder = (infoHash: InfoHash) => run('torrents.openFolder', { infoHash })

/** Saves the stored .torrent bytes through the native save dialog. */
export const exportTorrentFile = async (infoHash: InfoHash) => {
  const result = await run('torrents.exportFile', { infoHash })
  if (result.ok && result.value) toasts.exported()
}

/** Opens the remove confirmation for the given torrents, ignoring an empty selection. */
export const confirmRemove = (infoHashes: ReadonlyArray<InfoHash>) => {
  if (infoHashes.length > 0) openDialog({ kind: 'remove', infoHashes })
}

/** Opens the native picker, then the add dialog for the chosen file. */
export const pickTorrentFile = async () => {
  const result = await run('dialog.openTorrentFile')
  if (result.ok && result.value !== null) openDialog({ kind: 'addFile', path: result.value })
}

/** Opens the native folder picker starting at `current`; resolves to null when cancelled. */
export const pickFolder = async (current: string) => {
  const result = await run('dialog.pickFolder', current === '' ? {} : { defaultPath: current })
  return result.ok ? result.value : null
}

export const isTorrentPath = (path: string) => path.toLowerCase().endsWith('.torrent')

export const isMagnet = (text: string) => text.trim().toLowerCase().startsWith('magnet:')

/** Mirrors the update status and offers a non-blocking restart or download once an update is ready. */
export const applyUpdateStatus = (status: UpdateStatusValue) => {
  setUpdateStatus(status)
  const install = () => void run('updates.install')
  if (status._tag === 'Downloaded') toasts.updateReady(status.version, install)
  if (status._tag === 'ManualUpdate') toasts.updateManual(status.version, install)
}

export const loadUpdateStatus = async () => {
  const [status, version] = await Promise.all([run('updates.status'), run('app.version')])
  if (status.ok) applyUpdateStatus(status.value)
  if (version.ok) setAppVersion(version.value)
}

/** Persists a few settings right away, for controls such as the theme buttons that bypass the settings form. */
export const saveSettings = async (...args: CommandArgs<'settings.update'>) => {
  const result = await run('settings.update', ...args)
  if (result.ok) setSettings(result.value)
}

/** Opens the add dialog for each magnet link or .torrent file the OS handed to the app, one after another. */
export const openLaunchArgs = (args: ReadonlyArray<string>) =>
  queueDialogs(
    args.map((arg): Dialog =>
      isMagnet(arg) ? { kind: 'addMagnet', magnet: arg.trim() } : { kind: 'addFile', path: arg },
    ),
  )

export const loadLaunchArgs = async () => {
  const result = await run('launch.take')
  if (result.ok) openLaunchArgs(result.value)
}

export const openSettings = () => openDialog({ kind: 'settings' })

export const openAddMagnet = () => openDialog({ kind: 'addMagnet', magnet: '' })

export const openDetails = (infoHash: InfoHash) => openDialog({ kind: 'details', infoHash })
