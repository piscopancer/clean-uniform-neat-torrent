import { toast } from 'sonner'
import type { CommandArgs, CommandName } from '@shared/contract'
import { openDialog } from '@/store/dialogs'
import { setSettings } from '@/store/settings'
import { applySnapshot } from '@/store/torrents'
import { setAppVersion, setUpdateStatus, type UpdateStatusValue } from '@/store/updates'
import { run, type InfoHash } from './api'

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
  if (result.ok) toast.success('Torrent added', { description: result.value.name })
  return result.ok
}

/** Adds each file in turn so one bad file does not block the rest; returns how many were added. */
export const addFiles = async (paths: ReadonlyArray<string>, savePath = '') => {
  let added = 0
  for (const path of paths) {
    const result = await mutate('torrents.addFile', { path, ...withSavePath(savePath) })
    if (result.ok) added += 1
  }
  if (added > 0) toast.success(added === 1 ? 'Torrent added' : `${added} torrents added`)
  return added
}

export const pause = (infoHashes: ReadonlyArray<InfoHash>) => mutate('torrents.pause', { infoHashes })

export const resume = (infoHashes: ReadonlyArray<InfoHash>) => mutate('torrents.resume', { infoHashes })

export const remove = (infoHashes: ReadonlyArray<InfoHash>, deleteFiles: boolean) =>
  mutate('torrents.remove', { infoHashes, deleteFiles })

export const openFolder = (infoHash: InfoHash) => run('torrents.openFolder', { infoHash })

/** Opens the remove confirmation for the given torrents, ignoring an empty selection. */
export const confirmRemove = (infoHashes: ReadonlyArray<InfoHash>) => {
  if (infoHashes.length > 0) openDialog({ kind: 'remove', infoHashes })
}

/** Opens the native picker, then the add dialog for the chosen files. */
export const pickTorrentFiles = async () => {
  const result = await run('dialog.openTorrentFiles')
  if (result.ok && result.value.length > 0) openDialog({ kind: 'addFiles', paths: result.value })
}

/** Opens the native folder picker starting at `current`; resolves to null when cancelled. */
export const pickFolder = async (current: string) => {
  const result = await run('dialog.pickFolder', current === '' ? {} : { defaultPath: current })
  return result.ok ? result.value : null
}

export const isTorrentPath = (path: string) => path.toLowerCase().endsWith('.torrent')

export const isMagnet = (text: string) => text.trim().toLowerCase().startsWith('magnet:')

/** Mirrors the update status and offers a non-blocking restart once an update has been downloaded. */
export const applyUpdateStatus = (status: UpdateStatusValue) => {
  setUpdateStatus(status)
  if (status._tag !== 'Downloaded') return
  // the id keeps one prompt per version however often the status is re-sent
  toast.info(`Version ${status.version} is ready`, {
    id: `update-${status.version}`,
    description: 'Restart now or the update installs when you quit.',
    duration: Number.POSITIVE_INFINITY,
    action: { label: 'Restart', onClick: () => void run('updates.install') },
  })
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

export const openSettings = () => openDialog({ kind: 'settings' })
