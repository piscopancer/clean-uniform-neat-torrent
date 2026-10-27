import { toast } from 'sonner'
import { toastError } from './errors'

/** Every toast the app shows, in one place, so the --toast demo shows exactly what the app does. */
export const toasts = {
  downloadComplete: (name: string) => toast.success('Download complete', { description: name }),
  copied: (label: string) => toast.success(`${label} copied`),
  added: (name: string) => toast.success('Torrent added', { description: name }),
  addedMany: (count: number) => toast.success(count === 1 ? 'Torrent added' : `${count} torrents added`),
  exported: () => toast.success('Torrent file exported'),
  /** The id keeps one prompt per version however often the status is re-sent. */
  updateReady: (version: string, restart: () => void) =>
    toast.info(`Version ${version} is ready`, {
      id: `update-${version}`,
      description: 'Restart now or the update installs when you quit.',
      duration: Number.POSITIVE_INFINITY,
      action: { label: 'Restart', onClick: restart },
    }),
  error: toastError,
}
