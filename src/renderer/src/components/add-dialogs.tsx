import { useId, useState, type FormEvent, type ReactNode } from 'react'
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
import { addFiles, addMagnet, isMagnet } from '@/lib/actions'
import { baseName } from '@/lib/format'
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
}

/** Shared body of the add dialogs: their own fields, then the save folder prefilled with the default. */
const AddForm = ({ title, description, canSubmit, onSubmit, children }: AddFormProps) => {
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
    <DialogContent>
      <form className="contents" onSubmit={(event) => void submit(event)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="break-words">{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {children}
          <SaveFolderField value={savePath} onChange={setSavePath} />
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

/** The chosen file names stand in for the description, so the dialog needs no separate file list. */
const FilesForm = ({ paths }: { readonly paths: ReadonlyArray<string> }) => (
  <AddForm
    title={
      paths.length === 1 ? (
        <>
          Add a torrent <em>file</em>
        </>
      ) : (
        <>
          Add <em>{paths.length}</em> torrent files
        </>
      )
    }
    description={paths.map(baseName).join(', ')}
    canSubmit={paths.length > 0}
    onSubmit={async (savePath) => (await addFiles(paths, savePath)) > 0}
  />
)

export const AddMagnetDialog = () => {
  const { open, kept } = useKeptDialog('addMagnet')
  return (
    <Dialog open={open} onOpenChange={onDialogOpenChange}>
      {kept !== null && <MagnetForm key={kept.key} initial={kept.dialog.magnet} />}
    </Dialog>
  )
}

export const AddFilesDialog = () => {
  const { open, kept } = useKeptDialog('addFiles')
  return (
    <Dialog open={open} onOpenChange={onDialogOpenChange}>
      {kept !== null && <FilesForm key={kept.key} paths={kept.dialog.paths} />}
    </Dialog>
  )
}
