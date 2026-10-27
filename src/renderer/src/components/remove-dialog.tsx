import { useId, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { remove } from '@/lib/actions'
import type { InfoHash } from '@/lib/api'
import { onDialogOpenChange, useKeptDialog } from '@/store/dialogs'
import { useTorrents } from '@/store/torrents'

const RemoveContent = ({ infoHashes }: { readonly infoHashes: ReadonlyArray<InfoHash> }) => {
  const [deleteFiles, setDeleteFiles] = useState(false)
  const id = useId()
  const [first] = infoHashes
  const firstName = useTorrents((state) => (first === undefined ? undefined : state.byHash.get(first)?.name))
  const subject = infoHashes.length === 1 && firstName !== undefined ? firstName : `${infoHashes.length} torrents`
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="break-words">
          Remove <em>{subject}</em>?
        </AlertDialogTitle>
        {/* only for screen readers, which Radix expects a description for */}
        <AlertDialogDescription className="sr-only">
          The torrent leaves the list. Downloaded data stays on disk unless you choose to delete it.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={deleteFiles} onCheckedChange={(checked) => setDeleteFiles(checked === true)} />
        <Label htmlFor={id}>Also delete downloaded files</Label>
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={() => void remove(infoHashes, deleteFiles)}>
          Remove
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}

export const RemoveDialog = () => {
  const { open, kept } = useKeptDialog('remove')
  return (
    <AlertDialog open={open} onOpenChange={onDialogOpenChange}>
      {kept !== null && <RemoveContent infoHashes={kept.dialog.infoHashes} />}
    </AlertDialog>
  )
}
