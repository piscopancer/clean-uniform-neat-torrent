import {
  ArrowUpFromLineIcon,
  FileDownIcon,
  FileUpIcon,
  FolderOpenIcon,
  InfoIcon,
  LinkIcon,
  PauseIcon,
  PlayIcon,
  SquareIcon,
  Trash2Icon,
} from 'lucide-react'
import { useCallback, useRef, type MouseEvent } from 'react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
import {
  confirmRemove,
  exportTorrentFile,
  openAddMagnet,
  openDetails,
  openFolder,
  pause,
  pickTorrentFile,
  resume,
} from '@/lib/actions'
import type { InfoHash, Summary } from '@/lib/api'
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

/** Clears the selection when a press lands on the list's empty space, unless Ctrl or Shift is held, as in Explorer. */
export const clearOnEmptyPress = (event: MouseEvent) => {
  if (event.ctrlKey || event.metaKey || event.shiftKey) return
  if (event.target instanceof Element && event.target.closest(keepsSelection) === null) clearSelection()
}

type TorrentStatus = Summary['status']

/** Statuses a torrent can be resumed from; every other status is running and can be paused. */
const resumableStatuses: ReadonlySet<TorrentStatus> = new Set(['paused', 'completed', 'error'] as const)

/** Statuses of a finished torrent, where resuming and pausing start and stop seeding. */
const finishedStatuses: ReadonlySet<TorrentStatus> = new Set(['seeding', 'completed'] as const)

/** Whether any selected torrent's resumability matches, so Resume and Pause are only offered when they do something. */
const useSelectionHas = (resumable: boolean) =>
  useTorrents((state) =>
    [...state.selected].some((infoHash) => {
      const status = state.byHash.get(infoHash)?.status
      return status !== undefined && resumableStatuses.has(status) === resumable
    }),
  )

/** Whether every selected torrent is finished, so Resume and Pause read as starting and stopping seeding. */
const useSelectionFinished = () =>
  useTorrents((state) =>
    [...state.selected].every((infoHash) => {
      const status = state.byHash.get(infoHash)?.status
      return status !== undefined && finishedStatuses.has(status)
    }),
  )

/** Wording of Resume and Pause for unfinished torrents, and for finished ones that only seed. */
const transferItems = {
  download: { resume: { label: 'Resume', icon: PlayIcon }, pause: { label: 'Pause', icon: PauseIcon } },
  seed: {
    resume: { label: 'Start seeding', icon: ArrowUpFromLineIcon },
    pause: { label: 'Stop seeding', icon: SquareIcon },
  },
} as const

/** Whether exactly one torrent is selected and its .torrent bytes are known. */
const useCanExport = () =>
  useTorrents((state) => {
    const [only, ...rest] = state.selected
    return only !== undefined && rest.length === 0 && state.byHash.get(only)?.hasTorrentFile === true
  })

/** Ways to add torrents, offered when the right-click lands on empty space. */
const AddMenu = () => (
  <ContextMenuContent className="w-56">
    <ContextMenuItem onSelect={() => void pickTorrentFile()}>
      <FileUpIcon /> Add torrent file
      <ContextMenuShortcut>Ctrl+O</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem onSelect={openAddMagnet}>
      <LinkIcon /> Add magnet link
      <ContextMenuShortcut>Ctrl+M</ContextMenuShortcut>
    </ContextMenuItem>
  </ContextMenuContent>
)

/** Right-click menu of the list: torrent actions for a selection, ways to add torrents otherwise. */
export const ListMenu = () => {
  const nothingSelected = useTorrents((state) => state.selected.size === 0)
  return nothingSelected ? <AddMenu /> : <SelectionMenu />
}

/** Actions for the right-clicked selection. */
const SelectionMenu = () => {
  const canResume = useSelectionHas(true)
  const canPause = useSelectionHas(false)
  const canExport = useCanExport()
  const { resume: resumeItem, pause: pauseItem } = transferItems[useSelectionFinished() ? 'seed' : 'download']
  const run = (action: (infoHashes: ReadonlyArray<InfoHash>) => unknown) => () => void action(selectedHashes())
  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onSelect={run(([first]) => first !== undefined && openDetails(first))}>
        <InfoIcon /> Details
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={!canResume} onSelect={run(resume)}>
        <resumeItem.icon /> {resumeItem.label}
      </ContextMenuItem>
      <ContextMenuItem disabled={!canPause} onSelect={run(pause)}>
        <pauseItem.icon /> {pauseItem.label}
      </ContextMenuItem>
      <ContextMenuItem onSelect={run(([first]) => first !== undefined && openFolder(first))}>
        <FolderOpenIcon /> Open folder
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!canExport}
        onSelect={run(([first]) => first !== undefined && exportTorrentFile(first))}
      >
        <FileDownIcon /> Export .torrent…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={run(confirmRemove)}>
        <Trash2Icon /> Remove
        <ContextMenuShortcut>Del</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
