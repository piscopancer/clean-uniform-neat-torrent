import {
  createColumnHelper,
  createSortedRowModel,
  rowExpandingFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react'
import { useMemo, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { CountBadge } from '@/components/count-badge'
import { Hint } from '@/components/hint'
import { SortArrow } from '@/components/sort-arrow'
import { ProgressText } from '@/components/torrent-columns'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fileTree, type File, type FileNode } from '@/lib/file-tree'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useExtraVisuals } from '@/store/settings'

export type { File }

const features = tableFeatures({
  rowSortingFeature,
  rowExpandingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
})

const helper = createColumnHelper<typeof features, FileNode>()

const nameSpec = {
  id: 'name',
  header: 'Name',
  value: (node: FileNode) => node.name,
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
      value: (node: FileNode) => node.progress,
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
      value: (node: FileNode) => node.size,
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

const getRowId = (node: FileNode) => node.id

const getSubRows = (node: FileNode) => node.children

/** State of a checkbox over several files: checked, unchecked, or mixed when only some of them are chosen. */
const allState = (files: ReadonlyArray<File>) => {
  const count = files.filter((file) => file.selected).length
  return count === files.length ? true : count === 0 ? false : 'indeterminate'
}

/** Width of one tree level in rem, a checkbox and its gap, so a row's checkbox lines up under its folder's icon. */
const indent = 1.375
/** Left padding of a table cell in rem, which the tree indentation adds to. */
const cellPadding = 0.5

/** Every row in display order, children right after their folder, including those inside collapsed folders. */
const flatten = <R extends { readonly subRows: ReadonlyArray<R> }>(rows: ReadonlyArray<R>): Array<R> =>
  rows.flatMap((row) => [row, ...flatten(row.subRows)])

/** Keeps a click on a checkbox from also sorting the header or folding the folder row it sits in. */
const keepClick = (event: MouseEvent) => event.stopPropagation()

/**
 * Content of a cell that folds down to nothing while its row lies in a collapsed folder and unfolds again when the
 * folder opens. The padding lives inside the fold, since a padded cell could not shrink below it, so the cells that
 * use it drop their own. A `fluid` fold reports no width of its own to the table, so a long name is cut short with an
 * ellipsis instead of widening its column; any other fold keeps the width of its content, so its column fits it.
 */
const Fold = ({
  open,
  fluid = false,
  className,
  style,
  children,
}: {
  readonly open: boolean
  readonly fluid?: boolean
  readonly className?: string
  readonly style?: CSSProperties
  readonly children: ReactNode
}) => (
  <div
    className={cn(
      'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] opacity-0',
      fluid && 'grid-cols-1 contain-inline-size',
    )}
  >
    {/* a hidden overflow would let the table squeeze the content to nothing, so other folds clip only the height */}
    <div className={cn('min-h-0', fluid ? 'overflow-hidden' : 'overflow-y-clip')}>
      <div className={className} style={style}>
        {children}
      </div>
    </div>
  </div>
)

type FilesTableProps = {
  readonly files: ReadonlyArray<File>
  readonly mode: FilesTableMode
  /** Grey progress fill, for a paused torrent. */
  readonly muted?: boolean
  /** Whether the torrent is downloading, which sweeps light along the bars of the chosen files still incomplete. */
  readonly running?: boolean
  /** Receives the new choice for every file. */
  readonly onSelect: (isSelected: (file: File) => boolean) => void
  readonly className?: string
}

/**
 * Files of a torrent as a tree of collapsible folders, sortable by name and progress or size within each folder, with
 * a checkbox choosing whether to download each file or every file in a folder at once. A click on a folder row folds
 * its contents away or back with an animation, which is why every row stays rendered and only folds its cells. Folders
 * start expanded and stay as the user left them while progress updates arrive.
 */
export const FilesTable = ({ files, mode, muted = false, running = false, onSelect, className }: FilesTableProps) => {
  const tree = useMemo(() => fileTree(files), [files])
  const table = useTable({
    features,
    columns: columns[mode],
    data: tree,
    getRowId,
    getSubRows,
    initialState: { expanded: true },
    autoResetExpanded: false,
  })
  /** Sets every file in `chosen` to `checked` and leaves the others as they are; a mixed box selects everything. */
  const choose = (chosen: ReadonlyArray<File>, checked: boolean | 'indeterminate') => {
    const indices = new Set(chosen.map((file) => file.index))
    onSelect((file) => (indices.has(file.index) ? checked !== false : file.selected))
  }
  const extraVisuals = useExtraVisuals()
  const specs = columnSpecs[mode]
  return (
    // clipped rather than scrolling, so the table grows with its rows inside the dialog or sheet scroll
    <Table containerClassName={cn('overflow-clip', className)}>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            {group.headers.map((header, index) => (
              <TableHead
                key={header.id}
                colSpan={specs[index]?.colSpan}
                className={cn('h-8 cursor-pointer select-none', specs[index]?.className)}
                onClick={header.column.getToggleSortingHandler()}
              >
                <span className="inline-flex items-center gap-1.5">
                  {header.column.id === nameSpec.id && (
                    <Checkbox
                      aria-label="Download all files"
                      className="flex"
                      checked={allState(files)}
                      onCheckedChange={(checked) => choose(files, checked)}
                      onClick={keepClick}
                    />
                  )}
                  <table.FlexRender header={header} />
                  <SortArrow sorted={header.column.getIsSorted()} />
                </span>
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {flatten(table.getPreExpandedRowModel().rows).map((row) => {
          const node = row.original
          const checked = allState(node.files)
          const folder = row.getCanExpand()
          const expanded = row.getIsExpanded()
          const shown = row.getIsAllParentsExpanded()
          const Icon = folder ? (expanded ? FolderOpenIcon : FolderIcon) : FileIcon
          return (
            <TableRow
              key={node.id}
              inert={!shown}
              aria-expanded={folder ? expanded : undefined}
              className={cn(
                checked === false && 'text-muted-foreground',
                folder && 'cursor-pointer select-none',
                !shown && 'border-b-0',
              )}
              onClick={folder ? row.getToggleExpandedHandler() : undefined}
            >
              <Hint content={node.path}>
                <TableCell className="max-w-0 p-0">
                  <Fold
                    open={shown}
                    fluid
                    className="flex min-w-0 items-center gap-1.5 py-1"
                    style={{ paddingLeft: `${cellPadding + row.depth * indent}rem` }}
                  >
                    <Checkbox
                      aria-label={`Download ${node.name}`}
                      className="flex"
                      checked={checked}
                      onCheckedChange={(next) => choose(node.files, next)}
                      onClick={keepClick}
                    />
                    <Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{node.name}</span>
                    {folder && <CountBadge count={node.files.length} />}
                  </Fold>
                </TableCell>
              </Hint>
              {mode === 'progress' ? (
                <>
                  <TableCell className="p-0">
                    <Fold open={shown} className="px-2 py-1">
                      <Progress
                        value={node.progress * 100}
                        liquid={extraVisuals}
                        muted={muted}
                        running={running && node.files.some((file) => file.selected && file.progress < 1)}
                        className="w-40"
                      />
                    </Fold>
                  </TableCell>
                  <TableCell className="w-px p-0 text-right">
                    <Fold open={shown} className="py-1 pr-2 pl-3">
                      <ProgressText progress={node.progress} size={node.size} />
                    </Fold>
                  </TableCell>
                </>
              ) : (
                <TableCell className="w-px p-0 text-right font-mono text-xs tabular-nums">
                  <Fold open={shown} className="py-1 pr-2 pl-3">
                    {formatBytes(node.size)}
                  </Fold>
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
