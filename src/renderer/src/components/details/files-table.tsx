import { FilesTable, type File } from '@/components/files-table'
import type { Details } from '@/hooks/use-details'
import { isStopped } from '@/components/torrent-columns'
import { run } from '@/lib/api'

type TorrentFilesProps = {
  readonly details: Details
  /** Optimistically replaces the shown details, so checkboxes respond before the next poll. */
  readonly onChange: (details: Details) => void
  readonly reload: () => Promise<void>
}

/** Every file of an added torrent with its progress; changing the checkboxes applies the choice right away. */
export const TorrentFiles = ({ details, onChange, reload }: TorrentFilesProps) => {
  const { files } = details

  const apply = async (isSelected: (file: File) => boolean) => {
    const next = files.map((file) => ({ ...file, selected: isSelected(file) }))
    onChange({ ...details, files: next })
    const selected = next.filter((file) => file.selected).map((file) => file.index)
    await run('torrents.selectFiles', { infoHash: details.summary.infoHash, selected })
    await reload()
  }

  if (files.length === 0) return <p className="px-2 py-4 text-sm text-muted-foreground">Waiting for metadata…</p>

  return (
    <FilesTable
      files={files}
      mode="progress"
      muted={isStopped(details.summary.status)}
      onSelect={(isSelected) => void apply(isSelected)}
    />
  )
}
