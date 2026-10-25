import { FolderOpenIcon, PauseIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useRef, type MouseEvent } from 'react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
import { confirmRemove, openFolder, pause, resume } from '@/lib/actions'
import type { InfoHash } from '@/lib/api'
import { clearSelection, selectedHashes, selectRow, useTorrents, type SelectMode } from '@/store/torrents'

export type SelectHandler = (infoHash: InfoHash, event: MouseEvent) => void

const selectModeOf = (event: MouseEvent) =>
  (event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace') satisfies SelectMode

/** Stable mouse-down handler for rows and cards; `order` is the visible order that shift-click ranges follow. */
export const useSelectHandler = (order: ReadonlyArray<InfoHash>): SelectHandler => {
  // Items read the latest order through a ref so a re-sort does not re-render every memoized item.
  const orderRef = useRef(order)
  orderRef.current = order
  return useCallback((infoHash, event) => {
    const right = event.button === 2
    if (right && useTorrents.getState().selected.has(infoHash)) return
    selectRow(infoHash, right ? 'replace' : selectModeOf(event), orderRef.current)
  }, [])
}

/** Rows and cards carry `data-torrent-item`; the table header is excluded so sorting keeps the selection. */
const keepsSelection = '[data-torrent-item], thead'

/** Clears the selection when a press lands on the list's empty space rather than on a row or card. */
export const clearOnEmptyPress = (event: MouseEvent) => {
  if (event.target instanceof Element && event.target.closest(keepsSelection) === null) clearSelection()
}

/** Actions for the right-clicked selection. */
export const SelectionMenu = () => {
  const run = (action: (infoHashes: ReadonlyArray<InfoHash>) => unknown) => () => void action(selectedHashes())
  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onSelect={run(resume)}>
        <PlayIcon /> Resume
      </ContextMenuItem>
      <ContextMenuItem onSelect={run(pause)}>
        <PauseIcon /> Pause
      </ContextMenuItem>
      <ContextMenuItem onSelect={run(([first]) => first !== undefined && openFolder(first))}>
        <FolderOpenIcon /> Open folder
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={run(confirmRemove)}>
        <Trash2Icon /> Remove
        <ContextMenuShortcut>Del</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
