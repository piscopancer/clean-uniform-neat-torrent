import { CopyIcon, FolderOpenIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Hint } from '@/components/hint'
import { Button } from '@/components/ui/button'
import type { Details } from '@/hooks/use-details'
import { openFolder } from '@/lib/actions'
import { formatBytes, formatDate, formatRatio } from '@/lib/format'

const copy = async (label: string, text: string) => {
  await navigator.clipboard.writeText(text)
  toast.success(`${label} copied`)
}

const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="flex min-w-0 items-center gap-1">{children}</dd>
  </>
)

/** Selectable value with a copy button. */
const Copyable = ({ label, value }: { readonly label: string; readonly value: string }) => (
  <>
    <Hint content={value}>
      <span className="truncate font-mono text-xs select-text">{value}</span>
    </Hint>
    <Button variant="ghost" size="icon-xs" aria-label={`Copy ${label}`} onClick={() => void copy(label, value)}>
      <CopyIcon />
    </Button>
  </>
)

export const GeneralTab = ({ details }: { readonly details: Details }) => {
  const { summary } = details
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5 overflow-auto p-4 text-sm">
      <Field label="Name">
        <Hint content={summary.name}>
          <span className="truncate">{summary.name}</span>
        </Hint>
      </Field>
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
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Open folder"
          onClick={() => void openFolder(summary.infoHash)}
        >
          <FolderOpenIcon />
        </Button>
      </Field>
      <Field label="Added">{formatDate(summary.addedAt)}</Field>
      <Field label="Total size">{formatBytes(details.totalSize)}</Field>
      <Field label="Pieces">
        {details.pieceCount > 0 ? `${details.pieceCount} × ${formatBytes(details.pieceLength)}` : '—'}
      </Field>
      <Field label="Transferred">
        {formatBytes(summary.downloaded)} down, {formatBytes(summary.uploaded)} up, ratio {formatRatio(summary.ratio)}
      </Field>
      {details.comment !== '' && <Field label="Comment">{details.comment}</Field>}
      {summary.error !== null && (
        <Field label="Error">
          <span className="text-destructive">{summary.error}</span>
        </Field>
      )}
    </dl>
  )
}
