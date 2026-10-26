import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CircleAlertIcon,
  LoaderCircleIcon,
  PauseIcon,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { TorrentStatus } from '@shared/schemas'
import { Progress } from '@/components/ui/progress'
import type { Summary } from '@/lib/api'
import { formatBytes, formatEta, formatPercent, formatRatio, formatSpeed } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Hint } from './hint'

export const statusLabels = {
  metadata: 'Fetching metadata',
  downloading: 'Downloading',
  seeding: 'Seeding',
  paused: 'Paused',
  error: 'Error',
} as const satisfies Record<TorrentStatus, string>

const statusIcons = {
  metadata: LoaderCircleIcon,
  downloading: ArrowDownToLineIcon,
  seeding: ArrowUpFromLineIcon,
  paused: PauseIcon,
  error: CircleAlertIcon,
} as const satisfies Record<TorrentStatus, LucideIcon>

const statusClasses = {
  metadata: 'animate-spin text-muted-foreground',
  downloading: 'text-highlight',
  seeding: 'text-foreground',
  paused: 'text-muted-foreground',
  error: 'text-destructive',
} as const satisfies Record<TorrentStatus, string>

/** Sort position of each status, grouping active torrents first. */
const statusRanks = {
  downloading: 0,
  metadata: 1,
  seeding: 2,
  paused: 3,
  error: 4,
} as const satisfies Record<TorrentStatus, number>

/** Coloured status icon; the tooltip names the status and adds the error message when there is one. */
export const StatusIcon = ({ torrent }: { readonly torrent: Summary }) => {
  const Icon = statusIcons[torrent.status]
  const label = statusLabels[torrent.status]
  return (
    <Hint content={torrent.error === null ? label : `${label}: ${torrent.error}`}>
      <Icon className={cn('size-4 shrink-0', statusClasses[torrent.status])} aria-label={label} />
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
}

/** The percentage, optionally followed by the total, with a hint telling how much of the total has arrived. */
export const ProgressText = ({ progress, size, sizeInText = true }: ProgressBarProps) => (
  <Hint content={size === undefined ? null : `${formatBytes(size * progress)} / ${formatBytes(size)}`}>
    <span className={cn('shrink-0 text-xs tabular-nums', (size === undefined || !sizeInText) && 'w-12')}>
      {formatPercent(progress)}
      {size !== undefined && sizeInText && ` / ${formatBytes(size)}`}
    </span>
  </Hint>
)

/** Glass progress bar with the percentage written after it; shared by the table and the cards. */
export const ProgressBar = (props: ProgressBarProps) => (
  <div className="flex items-center gap-3.5">
    <Progress value={props.progress * 100} className="flex-1" />
    <ProgressText {...props} />
  </div>
)

/** A torrent's progress bar with its size, left out while the size is still unknown. */
export const TorrentProgress = ({
  torrent,
  sizeInText,
}: {
  readonly torrent: Summary
  readonly sizeInText: boolean
}) =>
  torrent.status === 'metadata' ? (
    <ProgressBar progress={torrent.progress} />
  ) : (
    <ProgressBar progress={torrent.progress} size={torrent.size} sizeInText={sizeInText} />
  )

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
    cell: (torrent) => <TorrentProgress torrent={torrent} sizeInText={false} />,
    className: 'w-44',
  },
  {
    id: 'status',
    header: 'Status',
    value: (torrent) => statusRanks[torrent.status],
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
