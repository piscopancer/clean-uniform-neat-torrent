import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { memo, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { openDetails } from '@/lib/actions'
import type { InfoHash, Summary } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useIsSelected, useTorrent, useVisibleList } from '@/store/torrents'
import { SortArrow } from './sort-arrow'
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
  const rows = table.getRowModel().rows
  const order = useMemo(() => rows.map((row) => row.original.infoHash), [rows])
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
        {order.map((infoHash) => (
          <TorrentRow key={infoHash} infoHash={infoHash} onSelect={onSelect} />
        ))}
      </TableBody>
    </Table>
  )
}
