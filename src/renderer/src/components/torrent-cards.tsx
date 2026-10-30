import { ArrowDownIcon, ArrowUpIcon, ClockIcon, GaugeIcon, UsersIcon, type LucideIcon } from 'lucide-react'
import { memo, useMemo } from 'react'
import type { TorrentLimits } from '@shared/schemas'
import { openDetails } from '@/lib/actions'
import type { InfoHash, Summary } from '@/lib/api'
import { formatEta, formatRate, formatSpeed, limitToText } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/settings'
import { useIsSelected, useTorrent, useVisibleList } from '@/store/torrents'
import { Hint } from './hint'
import { SpeedPill } from './speed-pill'
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

/** The global limit of a direction, under which every torrent without a limit of its own runs. */
const useGlobalLimit = (key: keyof TorrentLimits) => useSettings((state) => state.settings?.[key] ?? null)

/** Which limit a direction runs under and its rate: the torrent's own, which wins, the global one, or none. */
const appliedLimitOf = (own: number | null, global: number | null) =>
  own !== null
    ? ({ source: 'torrent', limit: own } as const)
    : global !== null
      ? ({ source: 'global', limit: global } as const)
      : null
type AppliedLimit = ReturnType<typeof appliedLimitOf>

/** One speed of the pill, after a gauge of the arrow's size while that direction runs under a limit: highlighted for the torrent's own, grey for the global one, the rate in KiB/s on hover. */
const SpeedStat = ({ applied, ...stat }: StatProps & { readonly applied: AppliedLimit }) => (
  <span className="inline-flex items-center gap-1">
    {applied !== null && (
      <Hint content={`${limitToText(applied.limit)} KiB/s`}>
        <GaugeIcon className={cn('size-3', applied.source === 'torrent' && 'text-highlight')} />
      </Hint>
    )}
    <Stat {...stat} />
  </span>
)

type SpeedsProps = {
  readonly down: string
  readonly up: string
  readonly limits: Readonly<Record<keyof TorrentLimits, AppliedLimit>>
}

/** Down and up speeds in one pill, each half hidden while its speed is blank, the whole pill when both are. */
const Speeds = ({ down, up, limits }: SpeedsProps) =>
  (down !== '' || up !== '') && (
    <SpeedPill
      down={
        down === '' ? null : <SpeedStat icon={ArrowDownIcon} label="Down" value={down} applied={limits.downloadLimit} />
      }
      up={up === '' ? null : <SpeedStat icon={ArrowUpIcon} label="Up" value={up} applied={limits.uploadLimit} />}
    />
  )

type CardProps = {
  readonly infoHash: InfoHash
  readonly onSelect: SelectHandler
}

/** One torrent card; like a table row it subscribes to its own summary to keep ticks cheap. */
const TorrentCard = memo(({ infoHash, onSelect }: CardProps) => {
  const torrent = useTorrent(infoHash)
  const selected = useIsSelected(infoHash)
  const globalDown = useGlobalLimit('downloadLimit')
  const globalUp = useGlobalLimit('uploadLimit')
  if (torrent === undefined) return null
  return (
    // two layers: a greyer base that shows as a frame, thicker at the bottom, under the raised card itself; the card's
    // corners are the base's less its border and padding, so the frame keeps one width around them
    <div
      className="cursor-default rounded-xl border bg-muted p-0.5 pb-2 shadow-raised select-none"
      data-torrent-item
      onMouseDown={(event) => onSelect(infoHash, event)}
      onDoubleClick={() => openDetails(infoHash)}
    >
      <div
        data-state={selected ? 'selected' : undefined}
        className="grid gap-2 rounded-[calc(var(--radius-xl)-1px-var(--spacing)*0.5)] raised p-3 hover:bg-accent data-[state=selected]:border-highlight/50 data-[state=selected]:bg-highlight/10"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Hint content={torrent.error ?? torrent.name}>
            <span className="min-w-0 truncate text-sm font-medium">{torrent.name}</span>
          </Hint>
          <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <Stat icon={UsersIcon} label="Peers" value={torrent.numPeers} />
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
              <StatusIcon torrent={torrent} className="size-3 stroke-[2.5]" />
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
            limits={{
              downloadLimit: appliedLimitOf(torrent.downloadLimit, globalDown),
              uploadLimit: appliedLimitOf(torrent.uploadLimit, globalUp),
            }}
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
