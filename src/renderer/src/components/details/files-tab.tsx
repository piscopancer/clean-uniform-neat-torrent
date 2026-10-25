import { Hint } from '@/components/hint'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Details } from '@/hooks/use-details'
import { run } from '@/lib/api'
import { formatBytes, formatPercent } from '@/lib/format'

type FilesTabProps = {
  readonly details: Details
  /** Optimistically replaces the shown details, so checkboxes respond before the next poll. */
  readonly onChange: (details: Details) => void
  readonly reload: () => Promise<void>
}

export const FilesTab = ({ details, onChange, reload }: FilesTabProps) => {
  const { files } = details
  const selectedCount = files.filter((file) => file.selected).length
  const allState = selectedCount === files.length ? true : selectedCount === 0 ? false : 'indeterminate'

  const apply = async (isSelected: (file: Details['files'][number]) => boolean) => {
    const next = files.map((file) => ({ ...file, selected: isSelected(file) }))
    onChange({ ...details, files: next })
    const selected = next.filter((file) => file.selected).map((file) => file.index)
    await run('torrents.selectFiles', { infoHash: details.summary.infoHash, selected })
    await reload()
  }

  if (files.length === 0) return <p className="p-4 text-sm text-muted-foreground">Waiting for metadata…</p>

  return (
    <Table className="table-fixed" containerClassName="h-full overflow-auto">
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-8 w-10">
            <Checkbox
              aria-label="Download all files"
              checked={allState}
              onCheckedChange={(checked) => void apply(() => checked === true)}
            />
          </TableHead>
          <TableHead className="h-8">Name</TableHead>
          <TableHead className="h-8 w-24 text-right">Size</TableHead>
          <TableHead className="h-8 w-48">Progress</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => (
          <TableRow key={file.index} className={file.selected ? undefined : 'text-muted-foreground'}>
            <TableCell className="py-1">
              <Checkbox
                aria-label={`Download ${file.name}`}
                checked={file.selected}
                onCheckedChange={(checked) =>
                  void apply((other) => (other.index === file.index ? checked === true : other.selected))
                }
              />
            </TableCell>
            <Hint content={file.path}>
              <TableCell className="truncate py-1">{file.path}</TableCell>
            </Hint>
            <TableCell className="py-1 text-right tabular-nums">{formatBytes(file.length)}</TableCell>
            <TableCell className="py-1">
              <div className="flex items-center gap-3.5">
                <Progress value={file.progress * 100} className="h-1.5" />
                <span className="w-12 shrink-0 text-xs tabular-nums">{formatPercent(file.progress)}</span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
