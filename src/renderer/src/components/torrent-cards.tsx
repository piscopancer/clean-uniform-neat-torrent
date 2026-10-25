import { ArrowDownIcon, ArrowUpIcon, ClockIcon, ScaleIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import { memo, useMemo } from 'react'
import { Progress } from '@/components/ui/progress'
import { openFolder } from '@/lib/actions'
import type { InfoHash, Summary } from '@/lib/api'
import { formatBytes, formatEta, formatPercent, formatRate, formatRatio, formatSpeed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useIsSelected, useTorrent, useTorrents } from '@/store/torrents'
import { Hint } from './hint'
import { StatusIcon } from './torrent-columns'
import { useSelectHandler, type SelectHandler } from './torrent-selection'

/** Tall progress bar with a muted fill and the percentage and transferred size written over it. */
const CardProgress = ({ torrent }: { readonly torrent: Summary }) => (
  <div className="relative h-6">
    <Progress
      value={torrent.progress * 100}
      className="absolute inset-0 h-full rounded-md bg-muted/40 [&>[data-slot=progress-indicator]]:bg-highlight/30"
    />
    <div className="relative flex h-full items-center justify-between px-2 text-xs tabular-nums">
      <span>{formatPercent(torrent.progress)}</span>
      {torrent.status !== 'metadata' && (
        <span>
          {formatBytes(torrent.size * torrent.progress)} / {formatBytes(torrent.size)}
        </span>
      )}
    </div>
  </div>
)

type StatProps = {
  readonly icon: LucideIcon
  /** Column name from the table, shown as the tooltip. */
  readonly label: string
  readonly value: string | number
}

/** One table column in compact form; blank values are hidden like the table's empty cells. */
const Stat = ({ icon: Icon, label, value }: StatProps) =>
  value !== '' && (
    <Hint content={label}>
      <span className="inline-flex items-center gap-1 tabular-nums">
        <Icon className="size-3" /> {value}
      </span>
    </Hint>
  )

type CardProps = {
  readonly infoHash: InfoHash
  readonly onSelect: SelectHandler
}

/** One torrent card; like a table row it subscribes to its own summary to keep ticks cheap. */
const TorrentCard = memo(({ infoHash, onSelect }: CardProps) => {
  const torrent = useTorrent(infoHash)
  const selected = useIsSelected(infoHash)
  if (torrent === undefined) return null
  return (
    <div
      data-state={selected ? 'selected' : undefined}
      className="grid cursor-default gap-2 rounded-lg border p-3 select-none hover:bg-muted/30 data-[state=selected]:border-highlight data-[state=selected]:bg-highlight/10"
      data-torrent-item
      onMouseDown={(event) => onSelect(infoHash, event)}
      onDoubleClick={() => void openFolder(infoHash)}
    >
      <Hint content={torrent.error ?? torrent.name}>
        <span className="truncate text-sm font-medium">{torrent.name}</span>
      </Hint>
      <CardProgress torrent={torrent} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <StatusIcon torrent={torrent} />
        <Stat
          icon={ArrowDownIcon}
          label="Down"
          value={
            // a downloading torrent always shows its rate, so a stall reads as 0 B/s rather than a missing value
            torrent.status === 'downloading' ? formatRate(torrent.downloadSpeed) : formatSpeed(torrent.downloadSpeed)
          }
        />
        <Stat icon={ArrowUpIcon} label="Up" value={formatSpeed(torrent.uploadSpeed)} />
        <span className="ml-auto flex items-center gap-3">
          <Stat icon={UsersIcon} label="Peers" value={torrent.numPeers} />
          <Stat icon={ScaleIcon} label="Ratio" value={formatRatio(torrent.ratio)} />
          <Stat icon={ClockIcon} label="ETA" value={formatEta(torrent.eta)} />
        </span>
      </div>
    </div>
  )
})

const layoutClasses = {
  list: 'flex flex-col',
  grid: 'grid grid-cols-[repeat(auto-fill,minmax(28rem,1fr))]',
} as const

export type CardLayout = keyof typeof layoutClasses

/** Cards in main's order, without sorting, stacked in a column or flowing into a responsive grid. */
export const TorrentCards = ({ layout }: { readonly layout: CardLayout }) => {
  const list = useTorrents((state) => state.list)
  const order = useMemo(() => list.map((torrent) => torrent.infoHash), [list])
  const onSelect = useSelectHandler(order)
  return (
    <div className="min-h-0 flex-1 overflow-auto p-2">
      <div className={cn('gap-2', layoutClasses[layout])}>
        {order.map((infoHash) => (
          <TorrentCard key={infoHash} infoHash={infoHash} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}
