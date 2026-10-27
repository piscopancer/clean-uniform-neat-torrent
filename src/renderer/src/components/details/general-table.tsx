import { CopyIcon, FolderOpenIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Hint } from '@/components/hint'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import type { Details } from '@/hooks/use-details'
import { openFolder } from '@/lib/actions'
import { formatBytes, formatDate, formatRatio } from '@/lib/format'
import { toasts } from '@/lib/toasts'

const copy = async (label: string, text: string) => {
  await navigator.clipboard.writeText(text)
  toasts.copied(label)
}

/**
 * One row of the table: the property name and its value, which may carry buttons after it. Both columns are at least
 * as tall as a button, so a single line of text sits level with its name whether a button follows it or not, while the
 * name stays by the first line of a value that wraps.
 */
const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell className="w-px py-1.5 pr-4 align-top leading-6 whitespace-nowrap text-muted-foreground">
      {label}
    </TableCell>
    <TableCell className="w-full max-w-0 py-1.5">
      <div className="flex min-h-6 min-w-0 items-center gap-1">{children}</div>
    </TableCell>
  </TableRow>
)

/** Look of the buttons acting on a value: glass like the theme buttons, pushed to the right end of the row. */
const valueButton = { variant: 'glass', size: 'xs', className: 'ml-auto' } as const

/** Selectable value with a copy button. */
const Copyable = ({ label, value }: { readonly label: string; readonly value: string }) => (
  <>
    <Hint content={value}>
      <span className="truncate select-text">{value}</span>
    </Hint>
    <Button {...valueButton} aria-label={`Copy ${label}`} onClick={() => void copy(label, value)}>
      <CopyIcon />
      Copy
    </Button>
  </>
)

/** Everything about the torrent as a two-column table of property and value. */
export const GeneralTable = ({ details }: { readonly details: Details }) => {
  const { summary } = details
  return (
    <div className="select-text">
      <Table>
        <TableBody>
          <Field label="Info hash">
            <Copyable label="Info hash" value={summary.infoHash} />
          </Field>
          <Field label="Magnet link">
            <Copyable label="Magnet link" value={details.magnetURI} />
          </Field>
          <Field label="Save path">
            <Hint content={summary.savePath}>
              <span className="truncate">{summary.savePath}</span>
            </Hint>
            <Button {...valueButton} aria-label="Open folder" onClick={() => void openFolder(summary.infoHash)}>
              <FolderOpenIcon />
              Open
            </Button>
          </Field>
          <Field label="Added">{formatDate(summary.addedAt)}</Field>
          <Field label="Total size">{formatBytes(details.totalSize)}</Field>
          <Field label="Pieces">
            {details.pieceCount > 0 ? `${details.pieceCount} × ${formatBytes(details.pieceLength)}` : '—'}
          </Field>
          <Field label="Transferred">
            {formatBytes(summary.downloaded)} down, {formatBytes(summary.uploaded)} up, ratio{' '}
            {formatRatio(summary.ratio)}
          </Field>
          {details.comment !== '' && <Field label="Comment">{details.comment}</Field>}
          {summary.error !== null && (
            <Field label="Error">
              <span className="text-destructive">{summary.error}</span>
            </Field>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
