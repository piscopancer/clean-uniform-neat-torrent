import { ListTreeIcon } from 'lucide-react'
import { useMemo } from 'react'
import type { TorrentStatus } from '@shared/schemas'
import { Button } from '@/components/ui/button'
import { saveSettings } from '@/lib/actions'
import { cn } from '@/lib/utils'
import { useGroupByStatus } from '@/store/settings'
import { CountBadge } from './count-badge'
import { Hint } from './hint'
import { segmentedItem, segmentedTrack } from './segmented'
import {
  statusClasses,
  statusGroupOf,
  statusGroups,
  statusIcons,
  statusLabels,
  type StatusGroup,
} from './torrent-columns'

type Section<T> = {
  /** Status the section collects, null for the single section of an ungrouped list. */
  readonly group: StatusGroup | null
  readonly items: ReadonlyArray<T>
}

/**
 * Splits items into status sections in display order, leaving out empty ones, or one section when grouping is off.
 * `visible` lists every item in display order, which shift-click ranges follow. `statusOf` must be a stable function.
 */
export const useStatusSections = <T,>(items: ReadonlyArray<T>, statusOf: (item: T) => TorrentStatus) => {
  const grouped = useGroupByStatus()
  return useMemo(() => {
    const sections: ReadonlyArray<Section<T>> = grouped
      ? statusGroups
          .map((group) => ({ group, items: items.filter((item) => statusGroupOf[statusOf(item)] === group) }))
          .filter((section) => section.items.length > 0)
      : [{ group: null, items }]
    const visible = sections.flatMap((section) => section.items)
    return { sections, visible }
  }, [items, statusOf, grouped])
}

type GroupHeaderProps = {
  readonly group: StatusGroup
  readonly count: number
  readonly className?: string
}

/** Heading of a status section: its icon, name and size in a glass capsule. */
export const GroupHeader = ({ group, count, className }: GroupHeaderProps) => {
  const Icon = statusIcons[group]
  const label = statusLabels[group]
  return (
    <div className={cn('flex items-center gap-2 px-1 py-1 text-xs font-medium text-foreground select-none', className)}>
      <Icon className={cn('size-3.5', statusClasses[group])} aria-label={label} />
      <span>{label}</span>
      <CountBadge count={count} />
    </div>
  )
}

/** Switch in the list bar that splits the list into status sections, styled as a one-segment control. */
export const GroupToggle = () => {
  const grouped = useGroupByStatus()
  return (
    <div className={segmentedTrack}>
      <Hint content="Group by status" side="bottom">
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn('size-7', segmentedItem)}
          aria-label="Group by status"
          aria-pressed={grouped}
          onClick={() => void saveSettings({ groupByStatus: !grouped })}
        >
          <ListTreeIcon className="size-4" />
        </Button>
      </Hint>
    </div>
  )
}
