import type { IpcErrorEncoded } from '@shared/errors'
import { toast } from 'sonner'

/** Human-readable title and description for each IPC error tag, used by toasts. */
export const describeError = (error: IpcErrorEncoded) => {
  switch (error._tag) {
    case 'InvalidMagnetError':
      return { title: 'Invalid magnet link', description: 'The link is not a valid magnet URI.' }
    case 'InvalidTorrentFileError':
      return { title: 'Invalid torrent file', description: `${error.path}: ${error.reason}` }
    case 'DuplicateTorrentError':
      return { title: 'Already added', description: `"${error.name}" is already in the list.` }
    case 'TorrentNotFoundError':
      return { title: 'Torrent not found', description: `No torrent with hash ${error.infoHash}.` }
    case 'SaveFolderMissingError':
      return { title: 'Save folder missing', description: `${error.path} does not exist or cannot be created.` }
    case 'TorrentEngineError':
      return { title: 'Torrent engine error', description: error.message }
    case 'PersistenceError':
      return { title: 'Could not save data', description: `${error.file}: ${error.message}` }
    case 'UpdateError':
      return { title: 'Update failed', description: error.message }
    case 'InvalidInputError':
      return { title: 'Invalid request', description: `${error.command}: ${error.message}` }
    case 'UnexpectedError':
      return { title: 'Unexpected error', description: error.message }
    default:
      return error satisfies never
  }
}

/** Shows the toast for an IPC error; the tag is the toast id, so a repeated error replaces its toast instead of stacking. */
export const toastError = (error: IpcErrorEncoded) => {
  const { title, description } = describeError(error)
  toast.error(title, { id: error._tag, description })
}
