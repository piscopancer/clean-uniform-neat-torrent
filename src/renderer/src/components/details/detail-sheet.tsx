import { useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useDetails } from '@/hooks/use-details'
import type { InfoHash } from '@/lib/api'
import { onDialogOpenChange, useKeptDialog } from '@/store/dialogs'
import { useTorrents } from '@/store/torrents'
import { Hint } from '../hint'
import { finishedStatuses, resumableStatuses, transferItems, transfers } from '../torrent-selection'
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

/** Square glass button before the title that resumes a stopped torrent and pauses a running one, worded as seeding once it is finished. */
const TransferToggle = ({ infoHash }: { readonly infoHash: InfoHash }) => {
  const status = useTorrents((state) => state.byHash.get(infoHash)?.status)
  if (status === undefined) return null
  const action = resumableStatuses.has(status) ? 'resume' : 'pause'
  const { label, icon: Icon } = transferItems[finishedStatuses.has(status) ? 'seed' : 'download'][action]
  return (
    <Hint content={label} side="bottom">
      <Button
        type="button"
        variant="glass"
        size="icon-sm"
        aria-label={label}
        onClick={() => void transfers[action]([infoHash])}
      >
        <Icon />
      </Button>
    </Hint>
  )
}

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
  const content = useRef<HTMLDivElement>(null)
  return (
    <Sheet open={open} onOpenChange={onDialogOpenChange}>
      <SheetContent
        // the sheet and its backdrop open under the toolbar, which doubles as the title bar
        ref={content}
        className="top-toolbar h-auto gap-0 overflow-y-auto rounded-l-2xl outline-none sm:max-w-2xl"
        overlayClassName="top-toolbar"
        showCloseButton={false}
        // the sheet takes focus itself rather than its first button, whose tooltip would otherwise open with it
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          content.current?.focus()
        }}
      >
        {/* the title and its close button stick to the top as glass, with the body scrolling under them */}
        <SheetHeader className="sticky top-0 z-10 bg-card/70 pr-12 pl-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {infoHash !== undefined && <TransferToggle infoHash={infoHash} />}
            <SheetTitle className="min-w-0 break-words">{name}</SheetTitle>
          </div>
          <SheetDescription className="sr-only">General information and files of the torrent</SheetDescription>
          <SheetCloseButton />
        </SheetHeader>
        {infoHash !== undefined && <SheetBody infoHash={infoHash} />}
      </SheetContent>
    </Sheet>
  )
}
