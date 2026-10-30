import { ArrowDownIcon, ArrowUpIcon, type LucideIcon } from 'lucide-react'
import { createContext, use, type ComponentProps, type ReactNode } from 'react'
import type { TorrentLimits } from '@shared/schemas'
import { cn } from '@/lib/utils'

type LimitKey = keyof TorrentLimits

/** Arrow and name of each limit's direction, for the global limits in the settings and a torrent's own in its menu. */
export const limitDirections = {
  downloadLimit: { label: 'Download', icon: ArrowDownIcon },
  uploadLimit: { label: 'Upload', icon: ArrowUpIcon },
} as const satisfies Record<LimitKey, { label: string; icon: LucideIcon }>

/** The patch that sets one direction alone, so the other direction keeps its limit. */
export const limitPatches = {
  downloadLimit: (downloadLimit: TorrentLimits[LimitKey]) => ({ downloadLimit }),
  uploadLimit: (uploadLimit: TorrentLimits[LimitKey]) => ({ uploadLimit }),
} as const satisfies Record<LimitKey, (limit: TorrentLimits[LimitKey]) => Partial<TorrentLimits>>

/** Small for cards and menus, where room is short, and the height of an input in forms. */
const pillSizes = {
  sm: { pill: 'h-7 text-xs', down: 'px-2.5', up: 'pr-2.5 pl-1.5', fillUp: 'pl-2.5', field: 'gap-1', icon: 'size-3' },
  md: { pill: 'h-9 text-sm', down: 'px-3', up: 'pr-3 pl-2', fillUp: 'pl-3', field: 'gap-1.5', icon: 'size-4' },
} as const satisfies Record<string, Record<string, string>>
type PillSize = keyof typeof pillSizes

/** Size of the pill around a PillField, which scales its arrow to match. */
const PillSizeContext = createContext<PillSize>('sm')

/** Digits that fit a half of the pill, up to 99 999 999 KiB/s, far above any real link. */
const maxLimitDigits = 8

type SpeedPillProps = {
  readonly down: ReactNode
  readonly up: ReactNode
  /** Stretches the pill over its container and splits it into halves of one width, the slant right in the middle. */
  readonly fill?: boolean
  readonly size?: PillSize
  /** Classes of the recess, such as a corner radius other than the full capsule, which the shadow overlay follows. */
  readonly className?: string
}

/**
 * Down and up halves in one recess; the up half is a shade greyer, meeting the down half along a slanted edge. The
 * recess shadow is an overlay on top, so it also falls over the greyer half. A half given as null is left out.
 */
export const SpeedPill = ({ down, up, fill = false, size = 'sm', className }: SpeedPillProps) => {
  const sizing = pillSizes[size]
  return (
    <PillSizeContext value={size}>
      <span
        className={cn(
          'relative inline-flex items-center overflow-hidden rounded-full bg-card',
          sizing.pill,
          fill && 'w-full',
          className,
        )}
      >
        {down !== null && (
          <span className={cn('flex items-center', sizing.down, fill && 'flex-1 basis-0')}>{down}</span>
        )}
        {up !== null && (
          <span
            className={cn('relative flex h-full items-center', sizing.up, fill && ['flex-1 basis-0', sizing.fillUp])}
          >
            {/* skewed past the right end, so only its slanted left edge shows; alone it fills the recess */}
            <span
              aria-hidden
              className={cn(
                'absolute inset-y-0 -right-4 left-0 -skew-x-20 bg-foreground/4',
                down === null && '-left-4',
              )}
            />
            <span className={cn('relative flex items-center', fill && 'flex-1')}>{up}</span>
          </span>
        )}
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] border shadow-sunken" />
      </span>
    </PillSizeContext>
  )
}

/** One half of a pill that takes a limit: the direction's arrow, then the field filling the rest of the half. */
export const PillField = ({ limitKey, children }: { readonly limitKey: LimitKey; readonly children: ReactNode }) => {
  const { icon: Icon } = limitDirections[limitKey]
  const sizing = pillSizes[use(PillSizeContext)]
  return (
    <label className={cn('flex min-w-0 flex-1 items-center tabular-nums', sizing.field)}>
      <Icon aria-hidden className={cn('shrink-0', sizing.icon)} />
      {children}
    </label>
  )
}

type PillInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'placeholder'> & {
  readonly limitKey: LimitKey
  /** Whole KiB/s, empty for none of its own, null when the torrents it stands for have different limits. */
  readonly value: string | null
  /** Shown while the field is empty: what applies without a limit of its own, ∞ when nothing does. */
  readonly emptyText?: string | undefined
  /** Receives the text with everything but digits dropped, so the limit can never go below 0. */
  readonly onDigits: (digits: string) => void
}

/** Borderless KiB/s field for a PillField, its digits dark against the grey arrow and placeholder; other props, a ref among them, go to the input. */
export const PillInput = ({ limitKey, value, emptyText = '∞', onDigits, className, ...props }: PillInputProps) => (
  <input
    {...props}
    aria-label={`${limitDirections[limitKey].label} limit, KiB/s`}
    inputMode="numeric"
    maxLength={maxLimitDigits}
    placeholder={value === null ? 'Mixed' : emptyText}
    value={value ?? ''}
    className={cn(
      'w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground aria-invalid:text-destructive',
      className,
    )}
    onChange={(event) => onDigits(event.target.value.replace(/\D/g, ''))}
  />
)
