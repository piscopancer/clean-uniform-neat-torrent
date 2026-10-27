import { FileUpIcon, CloudDownloadIcon, LayoutGridIcon, TableIcon, type LucideIcon } from 'lucide-react'
import { torrentViews, type TorrentView as View } from '@shared/schemas'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { pickTorrentFile, saveSettings } from '@/lib/actions'
import { useTorrentView } from '@/store/settings'
import { useTorrents, useVisibleList } from '@/store/torrents'
import { cn } from '@/lib/utils'
import { AeroBubbles } from './aero-bubbles'
import { Hint } from './hint'
import { segmentedItem, segmentedTrack } from './segmented'
import { TorrentCards } from './torrent-cards'
import { clearOnEmptyPress, ListMenu } from './torrent-selection'
import { TorrentTable } from './torrent-table'

const viewOptions = {
  table: { label: 'Table', icon: TableIcon },
  grid: { label: 'Cards in a grid', icon: LayoutGridIcon },
} as const satisfies Record<View, { label: string; icon: LucideIcon }>

/** Segmented control for the list layout: a recessed track with the current layout raised out of it. */
export const ViewSwitcher = () => {
  const current = useTorrentView()
  return (
    <div className={segmentedTrack}>
      {torrentViews.map((view) => {
        const { label, icon: Icon } = viewOptions[view]
        return (
          <Hint key={view} content={label} side="bottom">
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn('size-7', segmentedItem)}
              aria-label={label}
              aria-pressed={view === current}
              onClick={() => void saveSettings({ torrentView: view })}
            >
              <Icon className="size-4" />
            </Button>
          </Hint>
        )
      })}
    </div>
  )
}

/** The torrent list in the chosen layout, sharing selection and the right-click menu across layouts. */
export const TorrentView = () => {
  const view = useTorrentView()
  const empty = useTorrents((state) => state.list.length === 0)
  const loaded = useTorrents((state) => state.loaded)
  const unmatched = useVisibleList().length === 0 && !empty
  return (
    // non-modal so a press while the menu is open still reaches the list and can reselect, as in Explorer
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>
        {/* isolated so the bubbles drawn behind the list still sit above the panel */}
        <div className="relative isolate flex min-h-0 flex-1 flex-col" onMouseDown={clearOnEmptyPress}>
          <AeroBubbles />
          {!empty && (view === 'table' ? <TorrentTable /> : <TorrentCards />)}
          {unmatched && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No torrents match the search.
            </p>
          )}
          {loaded && empty && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <CloudDownloadIcon className="mb-1 size-14 opacity-50" strokeWidth={1.25} />
              Drop .torrent files here, paste a magnet link, or use Add.
              <Button variant="outline" className="pointer-events-auto" onClick={() => void pickTorrentFile()}>
                <FileUpIcon /> Choose torrent file
              </Button>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ListMenu />
    </ContextMenu>
  )
}
