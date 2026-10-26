import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { Hint } from '@/components/hint'
import { SortArrow } from '@/components/sort-arrow'
import { ProgressText } from '@/components/torrent-columns'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Details } from '@/hooks/use-details'
import { run } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useEnhancedVisuals } from '@/store/settings'

type File = Details['files'][number]

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
})

const helper = createColumnHelper<typeof features, File>()

/**
 * Sortable columns after the switch in display order, with the width class of the header. Progress spans the bar and
 * the text after it, so the text cell sizes itself to the longest text and every bar keeps the same length.
 */
const columnSpecs = [
  { id: 'name', header: 'Name', value: (file: File) => file.path, sortFn: 'text', className: 'w-full', colSpan: 1 },
  {
    id: 'progress',
    header: 'Progress',
    value: (file: File) => file.progress,
    sortFn: 'basic',
    className: '',
    colSpan: 2,
  },
] as const

const columns = helper.columns(
  columnSpecs.map((spec) => helper.accessor(spec.value, { id: spec.id, header: spec.header, sortFn: spec.sortFn })),
)

const getRowId = (file: File) => String(file.index)

type FilesTableProps = {
  readonly details: Details
  /** Optimistically replaces the shown details, so checkboxes respond before the next poll. */
  readonly onChange: (details: Details) => void
  readonly reload: () => Promise<void>
}

/** Every file of the torrent, sortable by name and progress, with a switch choosing whether to download it. */
export const FilesTable = ({ details, onChange, reload }: FilesTableProps) => {
  const { files } = details
  const table = useTable({ features, columns, data: files, getRowId })
  const allSelected = files.every((file) => file.selected)
  const enhancedVisuals = useEnhancedVisuals()
  const paused = details.summary.status === 'paused'

  const apply = async (isSelected: (file: File) => boolean) => {
    const next = files.map((file) => ({ ...file, selected: isSelected(file) }))
    onChange({ ...details, files: next })
    const selected = next.filter((file) => file.selected).map((file) => file.index)
    await run('torrents.selectFiles', { infoHash: details.summary.infoHash, selected })
    await reload()
  }

  if (files.length === 0) return <p className="px-2 py-4 text-sm text-muted-foreground">Waiting for metadata…</p>

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-card">
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            <TableHead className="h-8 w-px">
              <Switch
                aria-label="Download all files"
                checked={allSelected}
                onCheckedChange={(checked) => void apply(() => checked)}
              />
            </TableHead>
            {group.headers.map((header, index) => (
              <TableHead
                key={header.id}
                colSpan={columnSpecs[index]?.colSpan}
                className={cn('h-8 cursor-pointer select-none', columnSpecs[index]?.className)}
                onClick={header.column.getToggleSortingHandler()}
              >
                <span className="inline-flex items-center gap-1">
                  <table.FlexRender header={header} />
                  <SortArrow sorted={header.column.getIsSorted()} />
                </span>
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(({ original: file }) => (
          <TableRow key={file.index} className={file.selected ? undefined : 'text-muted-foreground'}>
            <TableCell className="py-1">
              <Switch
                aria-label={`Download ${file.name}`}
                checked={file.selected}
                onCheckedChange={(checked) =>
                  void apply((other) => (other.index === file.index ? checked : other.selected))
                }
              />
            </TableCell>
            <Hint content={file.path}>
              <TableCell className="max-w-0 truncate py-1">{file.path}</TableCell>
            </Hint>
            <TableCell className="py-1">
              <Progress value={file.progress * 100} liquid={enhancedVisuals} muted={paused} className="w-40" />
            </TableCell>
            <TableCell className="w-px py-1 pl-3 text-right whitespace-nowrap">
              <ProgressText progress={file.progress} size={file.length} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
