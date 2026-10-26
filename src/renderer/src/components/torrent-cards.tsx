import { ArrowDownIcon, ArrowUpIcon, ClockIcon, ScaleIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import { memo, useMemo } from 'react'
import { openDetails } from '@/lib/actions'
import type { InfoHash } from '@/lib/api'
import { formatEta, formatRate, formatRatio, formatSpeed } from '@/lib/format'
import { useIsSelected, useTorrent, useVisibleList } from '@/store/torrents'
import { Hint } from './hint'
import { progressOf, ProgressText, ProgressTube, StatusIcon } from './torrent-columns'
import { useSelectHandler, type SelectHandler } from './torrent-selection'

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
      className="grid cursor-default gap-2 rounded-xl raised p-3 select-none hover:bg-accent data-[state=selected]:border-highlight/50 data-[state=selected]:bg-highlight/10"
      data-torrent-item
      onMouseDown={(event) => onSelect(infoHash, event)}
      onDoubleClick={() => openDetails(infoHash)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Hint content={torrent.error ?? torrent.name}>
          <span className="min-w-0 truncate text-sm font-medium">{torrent.name}</span>
        </Hint>
        <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          <Stat icon={UsersIcon} label="Peers" value={torrent.numPeers} />
          <Stat icon={ScaleIcon} label="Ratio" value={formatRatio(torrent.ratio)} />
          <Stat icon={ClockIcon} label="ETA" value={formatEta(torrent.eta)} />
        </span>
      </div>
      <div className="flex">
        <ProgressTube {...progressOf(torrent)} />
      </div>
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
        <span className="ml-auto text-foreground">
          <ProgressText {...progressOf(torrent)} />
        </span>
      </div>
    </div>
  )
})

/** Cards in main's order, without sorting, flowing into a responsive grid. */
export const TorrentCards = () => {
  const list = useVisibleList()
  const order = useMemo(() => list.map((torrent) => torrent.infoHash), [list])
  const onSelect = useSelectHandler(order)
  return (
    <div className="min-h-0 flex-1 overflow-auto p-2">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(28rem,1fr))] gap-2">
        {order.map((infoHash) => (
          <TorrentCard key={infoHash} infoHash={infoHash} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}
