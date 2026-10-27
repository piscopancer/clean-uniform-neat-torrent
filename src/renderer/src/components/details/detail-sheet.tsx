import type { ReactNode } from 'react'
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDetails } from '@/hooks/use-details'
import type { InfoHash } from '@/lib/api'
import { onDialogOpenChange, useKeptDialog } from '@/store/dialogs'
import { useTorrents } from '@/store/torrents'
import { TorrentFiles } from './files-table'
import { GeneralTable } from './general-table'
import { SpeedChart } from './speed-chart'

type SectionProps = {
  readonly title: string
  readonly children: ReactNode
}

/** Titled part of the sheet body; the title lines up with the text in the first column of the tables. */
const Section = ({ title, children }: SectionProps) => (
  <section className="grid gap-1">
    <h3 className="px-2 text-sm font-medium">{title}</h3>
    {children}
  </section>
)

/** The speed chart, the general table and the files table, scrolling under the title. */
const SheetBody = ({ infoHash }: { readonly infoHash: InfoHash }) => {
  const [details, setDetails, reload] = useDetails(infoHash)
  if (details === null) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  return (
    <div className="flex flex-col gap-6 px-4 pb-4">
      <SpeedChart infoHash={infoHash} />
      <Section title="Details">
        <GeneralTable details={details} />
      </Section>
      <Section title="Files">
        <TorrentFiles details={details} onChange={setDetails} reload={reload} />
      </Section>
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
        showCloseButton={false}
      >
        {/* the title and its close button stick to the top as glass, with the body scrolling under them */}
        <SheetHeader className="sticky top-0 z-10 bg-card/70 px-6 pr-12 backdrop-blur-md">
          <SheetTitle className="break-words">{name}</SheetTitle>
          <SheetDescription className="sr-only">General information and files of the torrent</SheetDescription>
          <SheetCloseButton />
        </SheetHeader>
        {infoHash !== undefined && <SheetBody infoHash={infoHash} />}
      </SheetContent>
    </Sheet>
  )
}
