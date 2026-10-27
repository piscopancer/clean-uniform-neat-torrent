import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { Fragment, memo, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { openDetails } from '@/lib/actions'
import type { InfoHash, Summary } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useIsSelected, useTorrent, useVisibleList } from '@/store/torrents'
import { SortArrow } from './sort-arrow'
import { GroupHeader, useStatusSections } from './status-groups'
import { columnSpecs } from './torrent-columns'
import { useSelectHandler, type SelectHandler } from './torrent-selection'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
})

const helper = createColumnHelper<typeof features, Summary>()

const columns = helper.columns(
  columnSpecs.map((spec) => helper.accessor(spec.value, { id: spec.id, header: spec.header, sortFn: spec.sortFn })),
)

const getRowId = (torrent: Summary) => torrent.infoHash

const rowStatus = ({ original }: { readonly original: Summary }) => original.status

type RowProps = {
  readonly infoHash: InfoHash
  readonly onSelect: SelectHandler
}

/** One torrent row; it subscribes to its own summary, so a tick only re-renders rows whose numbers changed. */
const TorrentRow = memo(({ infoHash, onSelect }: RowProps) => {
  const torrent = useTorrent(infoHash)
  const selected = useIsSelected(infoHash)
  if (torrent === undefined) return null
  return (
    <TableRow
      data-state={selected ? 'selected' : undefined}
      className="cursor-default select-none data-[state=selected]:bg-highlight/15"
      data-torrent-item
      onMouseDown={(event) => onSelect(infoHash, event)}
      onDoubleClick={() => openDetails(infoHash)}
    >
      {columnSpecs.map((spec) => (
        <TableCell key={spec.id} className={cn('py-1.5', spec.className)}>
          {spec.cell(torrent)}
        </TableCell>
      ))}
    </TableRow>
  )
})

export const TorrentTable = () => {
  const data = useVisibleList()
  const table = useTable({ features, columns, data, getRowId })
  // sections keep the sorted order inside each status
  const { sections, visible } = useStatusSections(table.getRowModel().rows, rowStatus)
  const order = useMemo(() => visible.map((row) => row.original.infoHash), [visible])
  const onSelect = useSelectHandler(order)

  return (
    <Table className="table-fixed" containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-card">
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            {group.headers.map((header, index) => (
              <TableHead
                key={header.id}
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
        {sections.map((section) => (
          <Fragment key={section.group ?? 'all'}>
            {section.group !== null && (
              <TableRow className="hover:bg-transparent">
                {/* sticks under the column headers, which are h-8, while its rows scroll under it */}
                <TableCell
                  colSpan={columnSpecs.length}
                  className="sticky top-8 z-[5] bg-card/70 px-1 pt-4 pb-0.5 backdrop-blur-md [tr:first-child>&]:pt-0.5"
                >
                  <GroupHeader group={section.group} count={section.items.length} />
                </TableCell>
              </TableRow>
            )}
            {section.items.map(({ original: { infoHash } }) => (
              <TorrentRow key={infoHash} infoHash={infoHash} onSelect={onSelect} />
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  )
}
