import { ArrowDownToLineIcon, ArrowUpFromLineIcon, CircleAlertIcon, PauseIcon, SquareIcon } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import type { TorrentStatus } from '@shared/schemas'
import { Progress } from '@/components/ui/progress'
import type { Summary } from '@/lib/api'
import { formatBytes, formatEta, formatPercent, formatRatio, formatSpeed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useExtraVisuals } from '@/store/settings'
import { DropSplash } from './drop-splash'
import { Hint } from './hint'

export const statusLabels = {
  metadata: 'Fetching metadata',
  downloading: 'Downloading',
  seeding: 'Seeding',
  paused: 'Paused',
  completed: 'Completed',
  error: 'Error',
} as const satisfies Record<TorrentStatus, string>

export const statusIcons = {
  metadata: DropSplash,
  downloading: ArrowDownToLineIcon,
  seeding: ArrowUpFromLineIcon,
  paused: PauseIcon,
  completed: SquareIcon,
  error: CircleAlertIcon,
} as const satisfies Record<TorrentStatus, ComponentType<{ className: string; 'aria-label': string }>>

export const statusClasses = {
  metadata: 'text-highlight',
  downloading: 'text-highlight',
  seeding: 'text-muted-foreground',
  paused: 'text-muted-foreground',
  completed: 'text-muted-foreground',
  error: 'text-destructive',
} as const satisfies Record<TorrentStatus, string>

/** Sections of the list grouped by status, in display order; each is named after the status it collects. */
export const statusGroups = [
  'downloading',
  'paused',
  'seeding',
  'completed',
  'error',
] as const satisfies ReadonlyArray<TorrentStatus>
export type StatusGroup = (typeof statusGroups)[number]

/** Section of each status; a torrent still fetching metadata is on its way to downloading. */
export const statusGroupOf = {
  metadata: 'downloading',
  downloading: 'downloading',
  paused: 'paused',
  seeding: 'seeding',
  completed: 'completed',
  error: 'error',
} as const satisfies Record<TorrentStatus, StatusGroup>

/** Whether the torrent is stopped, finished or not, so its bar is drawn grey. */
export const isStopped = (status: TorrentStatus) => status === 'paused' || status === 'completed'

/** Coloured status icon; the tooltip names the status and adds the error message when there is one. */
export const StatusIcon = ({ torrent, className }: { readonly torrent: Summary; readonly className?: string }) => {
  const Icon = statusIcons[torrent.status]
  const label = statusLabels[torrent.status]
  return (
    <Hint content={torrent.error === null ? label : `${label}: ${torrent.error}`}>
      <Icon className={cn('size-4 shrink-0', statusClasses[torrent.status], className)} aria-label={label} />
    </Hint>
  )
}

type ColumnSpec = {
  readonly id: string
  readonly header: string
  /** Value the column sorts by. */
  readonly value: (torrent: Summary) => string | number
  readonly sortFn: 'text' | 'basic'
  readonly cell: (torrent: Summary) => ReactNode
  /** Width and alignment shared by the header and body cells. */
  readonly className: string
}

const numeric = 'text-right tabular-nums'

type ProgressBarProps = {
  /** Completed share from 0 to 1. */
  readonly progress: number
  /** Total bytes; when given, the hint over the percentage tells how much of it has arrived. */
  readonly size?: number
  /** Whether the total is also written after the percentage; off where a size column already shows it. */
  readonly sizeInText?: boolean
  /** Grey fill while the transfer is paused. */
  readonly muted?: boolean
  /** Light sweeping along the fill while the download is under way. */
  readonly running?: boolean
  /** Writes the percentage of a complete download in bold accent colour, unless it is paused. */
  readonly highlightComplete?: boolean
}

/** The percentage, optionally followed by the total, with a hint telling how much of the total has arrived. */
export const ProgressText = ({
  progress,
  size,
  sizeInText = true,
  muted = false,
  highlightComplete = false,
}: ProgressBarProps) => (
  <Hint content={size === undefined ? null : `${formatBytes(size * progress)} / ${formatBytes(size)}`}>
    {/* each part is its own leaf, so both keep the metal text while only the percentage may take the accent */}
    <span className={cn('shrink-0 font-mono text-xs tabular-nums', (size === undefined || !sizeInText) && 'w-[8ch]')}>
      <span className={cn(highlightComplete && !muted && progress >= 1 && 'font-bold text-highlight')}>
        {formatPercent(progress)}
      </span>
      {size !== undefined && sizeInText && <span>{` / ${formatBytes(size)}`}</span>}
    </span>
  </Hint>
)

/** The glass bar alone, liquid when extra visuals are on. */
export const ProgressTube = ({
  progress,
  muted = false,
  running = false,
}: Pick<ProgressBarProps, 'progress' | 'muted' | 'running'>) => (
  <Progress value={progress * 100} liquid={useExtraVisuals()} muted={muted} running={running} className="flex-1" />
)

/** Glass progress bar with the percentage written after it. */
export const ProgressBar = (props: ProgressBarProps) => (
  <div className="flex items-center gap-3.5">
    <ProgressTube {...props} />
    <ProgressText {...props} />
  </div>
)

/** Progress props of a torrent: its size only once known, a grey fill while stopped and a sweep while downloading. */
export const progressOf = (torrent: Summary) => ({
  progress: torrent.progress,
  muted: isStopped(torrent.status),
  running: torrent.status === 'downloading',
  ...(torrent.status === 'metadata' ? {} : { size: torrent.size }),
})

/** Every table column in display order; the TanStack column defs and the row cells both derive from this list. */
export const columnSpecs = [
  {
    id: 'name',
    header: 'Name',
    value: (torrent) => torrent.name,
    sortFn: 'text',
    cell: (torrent) => (
      <Hint content={torrent.error ?? torrent.name}>
        <span className="inline-block max-w-full truncate align-bottom">{torrent.name}</span>
      </Hint>
    ),
    className: '',
  },
  {
    id: 'size',
    header: 'Size',
    value: (torrent) => torrent.size,
    sortFn: 'basic',
    cell: (torrent) => (torrent.status === 'metadata' ? '' : formatBytes(torrent.size)),
    className: cn('w-24', numeric),
  },
  {
    id: 'progress',
    header: 'Progress',
    value: (torrent) => torrent.progress,
    sortFn: 'basic',
    cell: (torrent) => <ProgressBar {...progressOf(torrent)} sizeInText={false} />,
    className: 'w-44',
  },
  {
    id: 'status',
    header: 'Status',
    // sorts in the order of the status sections
    value: (torrent) => statusGroups.indexOf(statusGroupOf[torrent.status]),
    sortFn: 'basic',
    cell: (torrent) => <StatusIcon torrent={torrent} />,
    className: 'w-16',
  },
  {
    id: 'down',
    header: 'Down',
    value: (torrent) => torrent.downloadSpeed,
    sortFn: 'basic',
    cell: (torrent) => formatSpeed(torrent.downloadSpeed),
    className: cn('w-24', numeric),
  },
  {
    id: 'up',
    header: 'Up',
    value: (torrent) => torrent.uploadSpeed,
    sortFn: 'basic',
    cell: (torrent) => formatSpeed(torrent.uploadSpeed),
    className: cn('w-24', numeric),
  },
  {
    id: 'peers',
    header: 'Peers',
    value: (torrent) => torrent.numPeers,
    sortFn: 'basic',
    cell: (torrent) => torrent.numPeers,
    className: cn('w-16', numeric),
  },
  {
    id: 'eta',
    header: 'ETA',
    value: (torrent) => torrent.eta ?? Infinity,
    sortFn: 'basic',
    cell: (torrent) => formatEta(torrent.eta),
    className: cn('w-20', numeric),
  },
  {
    id: 'ratio',
    header: 'Ratio',
    value: (torrent) => torrent.ratio,
    sortFn: 'basic',
    cell: (torrent) => formatRatio(torrent.ratio),
    className: cn('w-16', numeric),
  },
] as const satisfies ReadonlyArray<ColumnSpec>

export type ColumnId = (typeof columnSpecs)[number]['id']
