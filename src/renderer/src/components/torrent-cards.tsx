import { ArrowDownIcon, ArrowUpIcon, ClockIcon, ScaleIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import { memo, useMemo } from 'react'
import { openDetails } from '@/lib/actions'
import type { InfoHash, Summary } from '@/lib/api'
import { formatEta, formatRate, formatRatio, formatSpeed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useIsSelected, useTorrent, useVisibleList } from '@/store/torrents'
import { Hint } from './hint'
import { GroupHeader, useStatusSections } from './status-groups'
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

/** Recess in the card that raised parts sit in, sharing the sunken shadow of switch and checkbox tracks. */
const socket = 'rounded-full bg-background shadow-sunken'

/**
 * Down and up speeds in one recess; the up half is a shade greyer, meeting the down half along a slanted edge. The
 * recess shadow is an overlay on top, so it also falls over the greyer half. Hidden when both speeds are blank.
 */
const Speeds = ({ down, up }: { readonly down: string; readonly up: string }) =>
  (down !== '' || up !== '') && (
    <span className="relative inline-flex h-7 items-center overflow-hidden rounded-full bg-card">
      {down !== '' && (
        <span className="flex items-center px-2.5">
          <Stat icon={ArrowDownIcon} label="Down" value={down} />
        </span>
      )}
      {up !== '' && (
        <span className="relative flex h-full items-center pr-2.5 pl-1.5">
          {/* skewed past the right end, so only its slanted left edge shows; alone it fills the recess */}
          <span
            aria-hidden
            className={cn('absolute inset-y-0 -right-4 left-0 -skew-x-20 bg-foreground/4', down === '' && '-left-4')}
          />
          <span className="relative flex items-center">
            <Stat icon={ArrowUpIcon} label="Up" value={up} />
          </span>
        </span>
      )}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full border shadow-sunken" />
    </span>
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
    // two layers: a greyer base that shows as a frame, thicker at the bottom, under the raised card itself
    <div
      className="cursor-default rounded-[14px] border bg-muted p-0.5 pb-2 shadow-raised select-none"
      data-torrent-item
      onMouseDown={(event) => onSelect(infoHash, event)}
      onDoubleClick={() => openDetails(infoHash)}
    >
      <div
        data-state={selected ? 'selected' : undefined}
        className="grid gap-2 rounded-xl raised p-3 hover:bg-accent data-[state=selected]:border-highlight/50 data-[state=selected]:bg-highlight/10"
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
          {/* the ball sits in a sunken socket */}
          <span className={cn('inline-flex p-0.5', socket)}>
            <span className="inline-flex size-6 items-center justify-center raised-sphere">
              <StatusIcon torrent={torrent} className="size-3 stroke-3" />
            </span>
          </span>
          <Speeds
            down={
              // a downloading torrent always shows its rate, so a stall reads as 0 B/s rather than a missing value
              torrent.status === 'downloading' ? formatRate(torrent.downloadSpeed) : formatSpeed(torrent.downloadSpeed)
            }
            up={
              // an active torrent can upload any moment, so it shows its up rate even while it is 0 B/s
              torrent.status === 'downloading' || torrent.status === 'seeding'
                ? formatRate(torrent.uploadSpeed)
                : formatSpeed(torrent.uploadSpeed)
            }
          />
          <span className="ml-auto self-start text-foreground">
            <ProgressText {...progressOf(torrent)} highlightComplete />
          </span>
        </div>
      </div>
    </div>
  )
})

const statusOf = (torrent: Summary) => torrent.status

/** Cards in main's order, without sorting, flowing into a responsive grid, one grid per status section. */
export const TorrentCards = () => {
  const { sections, visible } = useStatusSections(useVisibleList(), statusOf)
  const order = useMemo(() => visible.map((torrent) => torrent.infoHash), [visible])
  const onSelect = useSelectHandler(order)
  return (
    <div className="grid min-h-0 flex-1 content-start gap-5 overflow-auto p-2">
      {sections.map((section) => (
        <section key={section.group ?? 'all'} className="grid gap-1">
          {section.group !== null && <GroupHeader group={section.group} count={section.items.length} />}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(28rem,1fr))] gap-2">
            {section.items.map(({ infoHash }) => (
              <TorrentCard key={infoHash} infoHash={infoHash} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
