import { useEffect, useState } from 'react'
import {
  addFiles,
  addMagnet,
  confirmRemove,
  isMagnet,
  isTorrentPath,
  openSettings,
  pickTorrentFiles,
} from '@/lib/actions'
import { api } from '@/lib/api'
import { openDialog, useDialogs } from '@/store/dialogs'
import { clearSelection, selectAll, selectedHashes } from '@/store/torrents'

/** Whether the event target takes text input, where shortcuts and paste must keep their native meaning. */
const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select') !== null)

const dialogOpen = () => useDialogs.getState().dialog !== null

const hasDroppable = (event: DragEvent) =>
  event.dataTransfer !== null &&
  ['Files', 'text/uri-list', 'text/plain'].some((type) => event.dataTransfer?.types.includes(type))

/** Adds dropped .torrent files and magnet links with the default folder, as the spec asks for drag and drop. */
const handleDrop = (data: DataTransfer) => {
  const paths = [...data.files].map((file) => api.getPathForFile(file)).filter(isTorrentPath)
  if (paths.length > 0) return void addFiles(paths)
  const text = data.getData('text/uri-list') || data.getData('text/plain')
  const magnet = text.split(/\r?\n/).find(isMagnet)
  if (magnet !== undefined) void addMagnet(magnet)
}

const shortcuts: Readonly<Record<string, () => void>> = {
  'ctrl+a': selectAll,
  'ctrl+m': () => openDialog({ kind: 'addMagnet', magnet: '' }),
  'ctrl+o': () => void pickTorrentFiles(),
  'ctrl+,': openSettings,
  delete: () => confirmRemove(selectedHashes()),
  escape: clearSelection,
}

const shortcutOf = (event: KeyboardEvent) =>
  `${event.ctrlKey || event.metaKey ? 'ctrl+' : ''}${event.key.toLowerCase()}`

/** Wires window-level drag and drop, magnet paste and keyboard shortcuts; returns whether a drag is hovering. */
export const useAppInput = () => {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    // dragenter and dragleave fire for every child element, so a depth counter tracks when the pointer really leaves.
    let depth = 0
    const onDragEnter = (event: DragEvent) => {
      if (!hasDroppable(event)) return
      depth += 1
      setDragging(true)
    }
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDragOver = (event: DragEvent) => {
      // Without preventDefault the drop would navigate the window to the dropped file.
      event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      event.preventDefault()
      depth = 0
      setDragging(false)
      if (event.dataTransfer !== null && !dialogOpen()) handleDrop(event.dataTransfer)
    }
    const onPaste = (event: ClipboardEvent) => {
      if (isEditable(event.target) || dialogOpen()) return
      const text = event.clipboardData?.getData('text/plain') ?? ''
      if (!isMagnet(text)) return
      event.preventDefault()
      openDialog({ kind: 'addMagnet', magnet: text.trim() })
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditable(event.target) || dialogOpen()) return
      const action = shortcuts[shortcutOf(event)]
      if (action === undefined) return
      event.preventDefault()
      action()
    }
    const controller = new AbortController()
    const { signal } = controller
    window.addEventListener('dragenter', onDragEnter, { signal })
    window.addEventListener('dragleave', onDragLeave, { signal })
    window.addEventListener('dragover', onDragOver, { signal })
    window.addEventListener('drop', onDrop, { signal })
    window.addEventListener('paste', onPaste, { signal })
    window.addEventListener('keydown', onKeyDown, { signal })
    return () => controller.abort()
  }, [])

  return dragging
}
