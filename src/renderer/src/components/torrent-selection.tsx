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
import { LimitSection } from './torrent-limits'

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
export const resumableStatuses: ReadonlySet<TorrentStatus> = new Set(['paused', 'completed', 'error'] as const)

/** Statuses of a finished torrent, where resuming and pausing start and stop seeding. */
export const finishedStatuses: ReadonlySet<TorrentStatus> = new Set(['seeding', 'completed'] as const)

/** Resume and Pause by name, so one control can switch between them. */
export const transfers = { resume, pause } as const

/** Pause while any selected torrent runs, so a mixed selection stops as a whole; Resume once every one is stopped. */
const useSelectionTransfer = () =>
  useTorrents((state) =>
    [...state.selected].some((infoHash) => {
      const status = state.byHash.get(infoHash)?.status
      return status !== undefined && !resumableStatuses.has(status)
    }),
  )
    ? 'pause'
    : 'resume'

/** Whether every selected torrent is finished, so Resume and Pause read as starting and stopping seeding. */
const useSelectionFinished = () =>
  useTorrents((state) =>
    [...state.selected].every((infoHash) => {
      const status = state.byHash.get(infoHash)?.status
      return status !== undefined && finishedStatuses.has(status)
    }),
  )

/** Wording of Resume and Pause for unfinished torrents, and for finished ones that only seed. */
export const transferItems = {
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
      <FileUpIcon /> <span>Add torrent file</span>
      <ContextMenuShortcut>Ctrl+O</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem onSelect={openAddMagnet}>
      <LinkIcon /> <span>Add magnet link</span>
      <ContextMenuShortcut>Ctrl+M</ContextMenuShortcut>
    </ContextMenuItem>
  </ContextMenuContent>
)

/** Right-click menu of the list: torrent actions for a selection, ways to add torrents otherwise; item labels sit in spans, since the metal text skips the items' own slot. */
export const ListMenu = () => {
  const nothingSelected = useTorrents((state) => state.selected.size === 0)
  return nothingSelected ? <AddMenu /> : <SelectionMenu />
}

/** Actions for the right-clicked selection. */
const SelectionMenu = () => {
  const transfer = useSelectionTransfer()
  const canExport = useCanExport()
  const { label: transferLabel, icon: TransferIcon } =
    transferItems[useSelectionFinished() ? 'seed' : 'download'][transfer]
  const run = (action: (infoHashes: ReadonlyArray<InfoHash>) => unknown) => () => void action(selectedHashes())
  return (
    <ContextMenuContent className="w-52">
      <ContextMenuItem onSelect={run(transfers[transfer])}>
        <TransferIcon /> <span>{transferLabel}</span>
      </ContextMenuItem>
      <ContextMenuItem onSelect={run(([first]) => first !== undefined && openDetails(first))}>
        <InfoIcon /> <span>Details</span>
      </ContextMenuItem>
      <LimitSection />
      <ContextMenuItem onSelect={run(([first]) => first !== undefined && openFolder(first))}>
        <FolderOpenIcon /> <span>Open folder</span>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!canExport}
        onSelect={run(([first]) => first !== undefined && exportTorrentFile(first))}
      >
        <FileDownIcon /> <span>Export .torrent…</span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={run(confirmRemove)}>
        <Trash2Icon /> <span>Remove</span>
        <ContextMenuShortcut>Del</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
