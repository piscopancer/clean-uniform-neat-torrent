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
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Output } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useEnhancedVisuals } from '@/store/settings'

export type File = Output<'torrents.inspectFile'>['files'][number]

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
})

const helper = createColumnHelper<typeof features, File>()

const nameSpec = {
  id: 'name',
  header: 'Name',
  value: (file: File) => file.path,
  sortFn: 'text',
  className: 'w-full',
  colSpan: 1,
} as const

/**
 * Sortable columns after the checkbox in display order, with the width class of the header, per table mode. Progress
 * spans the bar and the text after it, so the text cell sizes itself to the longest text and every bar keeps the same
 * length. Size replaces it before the torrent is added, when nothing has been downloaded yet.
 */
const columnSpecs = {
  progress: [
    nameSpec,
    {
      id: 'progress',
      header: 'Progress',
      value: (file: File) => file.progress,
      sortFn: 'basic',
      className: '',
      colSpan: 2,
    },
  ],
  size: [
    nameSpec,
    {
      id: 'size',
      header: 'Size',
      value: (file: File) => file.length,
      sortFn: 'basic',
      className: 'text-right',
      colSpan: 1,
    },
  ],
} as const

export type FilesTableMode = keyof typeof columnSpecs

const columnsOf = (mode: FilesTableMode) =>
  helper.columns(
    columnSpecs[mode].map((spec) =>
      helper.accessor(spec.value, { id: spec.id, header: spec.header, sortFn: spec.sortFn }),
    ),
  )

const columns = { progress: columnsOf('progress'), size: columnsOf('size') } as const

const getRowId = (file: File) => String(file.index)

/** State of the header checkbox: checked, unchecked, or mixed when only some files are chosen. */
const allState = (files: ReadonlyArray<File>) => {
  const count = files.filter((file) => file.selected).length
  return count === files.length ? true : count === 0 ? false : 'indeterminate'
}

type FilesTableProps = {
  readonly files: ReadonlyArray<File>
  readonly mode: FilesTableMode
  /** Grey progress fill, for a paused torrent. */
  readonly muted?: boolean
  /** Receives the new choice for every file. */
  readonly onSelect: (isSelected: (file: File) => boolean) => void
  readonly className?: string
}

/** Files of a torrent, sortable by name and progress or size, with a checkbox choosing whether to download each. */
export const FilesTable = ({ files, mode, muted = false, onSelect, className }: FilesTableProps) => {
  const table = useTable({ features, columns: columns[mode], data: files, getRowId })
  const enhancedVisuals = useEnhancedVisuals()
  const specs = columnSpecs[mode]
  return (
    // clipped rather than scrolling, so the table grows with its rows and the header sticks to the dialog or sheet scroll
    <Table containerClassName={cn('overflow-clip', className)}>
      <TableHeader className="sticky top-0 z-10 bg-card">
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            <TableHead className="h-8 w-px">
              <Checkbox
                aria-label="Download all files"
                className="flex"
                checked={allState(files)}
                // a mixed header selects everything, as in file managers
                onCheckedChange={(checked) => onSelect(() => checked !== false)}
              />
            </TableHead>
            {group.headers.map((header, index) => (
              <TableHead
                key={header.id}
                colSpan={specs[index]?.colSpan}
                className={cn('h-8 cursor-pointer select-none', specs[index]?.className)}
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
              <Checkbox
                aria-label={`Download ${file.name}`}
                className="flex"
                checked={file.selected}
                onCheckedChange={(checked) =>
                  onSelect((other) => (other.index === file.index ? checked === true : other.selected))
                }
              />
            </TableCell>
            <Hint content={file.path}>
              <TableCell className="max-w-0 truncate py-1">{file.path}</TableCell>
            </Hint>
            {mode === 'progress' ? (
              <>
                <TableCell className="py-1">
                  <Progress value={file.progress * 100} liquid={enhancedVisuals} muted={muted} className="w-40" />
                </TableCell>
                <TableCell className="w-px py-1 pl-3 text-right whitespace-nowrap">
                  <ProgressText progress={file.progress} size={file.length} />
                </TableCell>
              </>
            ) : (
              <TableCell className="w-px py-1 pl-3 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                {formatBytes(file.length)}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
