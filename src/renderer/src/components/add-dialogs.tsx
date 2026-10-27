import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FilesTable, type File } from '@/components/files-table'
import { addFile, addMagnet, isMagnet } from '@/lib/actions'
import { run } from '@/lib/api'
import { baseName, formatBytes } from '@/lib/format'
import { closeDialog, onDialogOpenChange, useKeptDialog } from '@/store/dialogs'
import { useDownloadFolder } from '@/store/settings'
import { SaveFolderField } from './save-folder-field'

type AddFormProps = {
  /** Serif heading; wrap the word to emphasise in <em>. */
  readonly title: ReactNode
  readonly description: string
  readonly canSubmit: boolean
  /** Adds the torrent(s) to the given folder and resolves to whether the dialog may close. */
  readonly onSubmit: (savePath: string) => Promise<boolean>
  readonly children?: ReactNode
  readonly className?: string
  /** Puts the save folder above the dialog's own fields, for fields that grow long like a file table. */
  readonly folderFirst?: boolean
}

/** Shared body of the add dialogs: their own fields and the save folder prefilled with the default. */
const AddForm = ({
  title,
  description,
  canSubmit,
  onSubmit,
  children,
  className,
  folderFirst = false,
}: AddFormProps) => {
  const [savePath, setSavePath] = useState(useDownloadFolder())
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const done = await onSubmit(savePath.trim())
    setBusy(false)
    if (done) closeDialog()
  }
  return (
    <DialogContent className={className}>
      <form className="contents" onSubmit={(event) => void submit(event)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="break-words">{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {folderFirst && <SaveFolderField value={savePath} onChange={setSavePath} />}
          {children}
          {!folderFirst && <SaveFolderField value={savePath} onChange={setSavePath} />}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || busy}>
            Add
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

const MagnetForm = ({ initial }: { readonly initial: string }) => {
  const [magnet, setMagnet] = useState(initial)
  const id = useId()
  return (
    <AddForm
      title={
        <>
          Add a <em>magnet</em> link
        </>
      }
      description="Metadata is fetched from peers before the download starts."
      canSubmit={isMagnet(magnet)}
      onSubmit={(savePath) => addMagnet(magnet, savePath)}
    >
      <div className="grid gap-2">
        <Label htmlFor={id}>Magnet link</Label>
        <Input
          id={id}
          value={magnet}
          onChange={(event) => setMagnet(event.target.value)}
          placeholder="magnet:?xt=urn:btih:…"
          spellCheck={false}
          autoFocus
        />
      </div>
    </AddForm>
  )
}

/** Reads the file list of a .torrent file; a failure is toasted and closes the dialog, since there is nothing to add. */
const usePreviewFiles = (path: string) => {
  const [files, setFiles] = useState<ReadonlyArray<File> | null>(null)
  useEffect(() => {
    let current = true
    void run('torrents.inspectFile', { path }).then((result) => {
      if (!current) return
      if (result.ok) setFiles(result.value.files)
      else closeDialog()
    })
    return () => {
      current = false
    }
  }, [path])
  return [files, setFiles] as const
}

/** The file name stands in for the description; the table chooses which files of the torrent to download. */
const FileForm = ({ path }: { readonly path: string }) => {
  const [files, setFiles] = usePreviewFiles(path)
  const chosen = files?.filter((file) => file.selected) ?? []
  const total = files?.reduce((sum, file) => sum + file.length, 0) ?? 0
  const chosenSize = chosen.reduce((sum, file) => sum + file.length, 0)
  return (
    <AddForm
      title={
        <>
          Add a torrent <em>file</em>
        </>
      }
      description={baseName(path)}
      className="sm:max-w-2xl"
      folderFirst
      canSubmit={chosen.length > 0}
      onSubmit={(savePath) =>
        // every file chosen is sent as no choice, so files are not restricted needlessly
        addFile(path, savePath, chosen.length === files?.length ? undefined : chosen.map((file) => file.index))
      }
    >
      {files === null ? (
        <p className="text-sm text-muted-foreground">Reading the torrent…</p>
      ) : (
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label>Files</Label>
            <p className="text-xs text-muted-foreground">
              {chosen.length} of {files.length} files · {formatBytes(chosenSize)} of {formatBytes(total)}
            </p>
          </div>
          <FilesTable
            files={files}
            mode="size"
            className="rounded-lg border"
            onSelect={(isSelected) => setFiles(files.map((file) => ({ ...file, selected: isSelected(file) })))}
          />
        </div>
      )}
    </AddForm>
  )
}

export const AddMagnetDialog = () => {
  const { open, kept } = useKeptDialog('addMagnet')
  return (
    <Dialog open={open} onOpenChange={onDialogOpenChange}>
      {kept !== null && <MagnetForm key={kept.key} initial={kept.dialog.magnet} />}
    </Dialog>
  )
}

export const AddFileDialog = () => {
  const { open, kept } = useKeptDialog('addFile')
  return (
    <Dialog open={open} onOpenChange={onDialogOpenChange}>
      {kept !== null && <FileForm key={kept.key} path={kept.dialog.path} />}
    </Dialog>
  )
}
