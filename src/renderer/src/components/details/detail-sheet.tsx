import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDetails } from '@/hooks/use-details'
import type { InfoHash } from '@/lib/api'
import { onDialogOpenChange, useKeptDialog } from '@/store/dialogs'
import { useTorrents } from '@/store/torrents'
import { FilesTable } from './files-table'
import { GeneralTable } from './general-table'
import { SpeedChart } from './speed-chart'

/** The speed chart, the general table and the files table; the whole sheet scrolls, title included. */
const SheetBody = ({ infoHash }: { readonly infoHash: InfoHash }) => {
  const [details, setDetails, reload] = useDetails(infoHash)
  if (details === null) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  return (
    <div className="flex flex-col gap-6 px-2 pb-4">
      <SpeedChart infoHash={infoHash} />
      <GeneralTable details={details} />
      <FilesTable details={details} onChange={setDetails} reload={reload} />
    </div>
  )
}

/** Drawer sliding in from the right with details of the torrent it was opened for, by double-click or the context menu. */
export const DetailSheet = () => {
  const { open, kept } = useKeptDialog('details')
  const infoHash = kept?.dialog.infoHash
  const name = useTorrents((state) => (infoHash === undefined ? undefined : state.byHash.get(infoHash)?.name))
  return (
    <Sheet open={open} onOpenChange={onDialogOpenChange}>
      <SheetContent
        // the sheet and its backdrop open under the toolbar, which doubles as the title bar
        className="top-toolbar h-auto gap-0 overflow-y-auto rounded-l-2xl sm:max-w-2xl"
        overlayClassName="top-toolbar"
      >
        <SheetHeader className="pr-10">
          <SheetTitle className="break-words">{name}</SheetTitle>
          <SheetDescription className="sr-only">General information and files of the torrent</SheetDescription>
        </SheetHeader>
        {infoHash !== undefined && <SheetBody infoHash={infoHash} />}
      </SheetContent>
    </Sheet>
  )
}
