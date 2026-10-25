import { FileUpIcon, CloudDownloadIcon, LayoutGridIcon, Rows3Icon, TableIcon, type LucideIcon } from 'lucide-react'
import { torrentViews, type TorrentView as View } from '@shared/schemas'
import { Button } from '@/components/ui/button'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { pickTorrentFiles, saveSettings } from '@/lib/actions'
import { cn } from '@/lib/utils'
import { useTorrentView } from '@/store/settings'
import { useTorrents } from '@/store/torrents'
import { Hint } from './hint'
import { TorrentCards } from './torrent-cards'
import { clearOnEmptyPress, SelectionMenu } from './torrent-selection'
import { TorrentTable } from './torrent-table'

const viewOptions = {
  table: { label: 'Table', icon: TableIcon },
  list: { label: 'Cards in a column', icon: Rows3Icon },
  grid: { label: 'Cards in a grid', icon: LayoutGridIcon },
} as const satisfies Record<View, { label: string; icon: LucideIcon }>

const ViewSwitcher = ({ current }: { readonly current: View }) => (
  <div className="flex justify-end gap-0.5 border-b px-2 py-1">
    {torrentViews.map((view) => {
      const { label, icon: Icon } = viewOptions[view]
      return (
        <Hint key={view} content={label}>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              view === current && 'bg-highlight/15 text-highlight hover:bg-highlight/25 hover:text-highlight',
            )}
            aria-label={label}
            aria-pressed={view === current}
            onClick={() => void saveSettings({ torrentView: view })}
          >
            <Icon />
          </Button>
        </Hint>
      )
    })}
  </div>
)

/** The torrent list in the chosen layout, sharing selection and the right-click menu across layouts. */
export const TorrentView = () => {
  const view = useTorrentView()
  const empty = useTorrents((state) => state.list.length === 0)
  const loaded = useTorrents((state) => state.loaded)
  return (
    <>
      <ViewSwitcher current={view} />
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={empty}>
          <div className="relative flex min-h-0 flex-1 flex-col" onMouseDown={clearOnEmptyPress}>
            {!empty && (view === 'table' ? <TorrentTable /> : <TorrentCards layout={view} />)}
            {loaded && empty && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <CloudDownloadIcon className="mb-1 size-14 opacity-50" strokeWidth={1.25} />
                Drop .torrent files here, paste a magnet link, or use Add.
                <Button variant="outline" className="pointer-events-auto" onClick={() => void pickTorrentFiles()}>
                  <FileUpIcon /> Choose torrent file
                </Button>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <SelectionMenu />
      </ContextMenu>
    </>
  )
}
