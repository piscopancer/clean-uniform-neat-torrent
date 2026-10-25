import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDetails } from '@/hooks/use-details'
import type { InfoHash } from '@/lib/api'
import { useFocused } from '@/store/torrents'
import { FilesTab } from './files-tab'
import { GeneralTab } from './general-tab'
import { PeersTab } from './peers-tab'

const tabs = ['files', 'peers', 'general'] as const
type Tab = (typeof tabs)[number]

const isTab = (value: string): value is Tab => tabs.some((tab) => tab === value)

const PanelBody = ({ infoHash, tab, onTab }: { infoHash: InfoHash; tab: Tab; onTab: (tab: Tab) => void }) => {
  const [details, setDetails, reload] = useDetails(infoHash)
  return (
    <Tabs value={tab} onValueChange={(value) => isTab(value) && onTab(value)} className="h-full gap-0">
      <TabsList className="mx-2 mt-2">
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="peers">Peers{details !== null && ` (${details.peers.length})`}</TabsTrigger>
        <TabsTrigger value="general">General</TabsTrigger>
      </TabsList>
      {details === null ? (
        <p className="p-4 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <TabsContent value="files" className="min-h-0 overflow-auto">
            <FilesTab details={details} onChange={setDetails} reload={reload} />
          </TabsContent>
          <TabsContent value="peers" className="min-h-0 overflow-auto">
            <PeersTab peers={details.peers} />
          </TabsContent>
          <TabsContent value="general" className="min-h-0 overflow-auto">
            <GeneralTab details={details} />
          </TabsContent>
        </>
      )}
    </Tabs>
  )
}

/** Bottom panel with details of the focused torrent; hidden while nothing is selected. */
export const DetailPanel = () => {
  const focused = useFocused()
  const [tab, setTab] = useState<Tab>('files')
  if (focused === null) return null
  return (
    <section className="h-72 shrink-0 border-t">
      <PanelBody infoHash={focused} tab={tab} onTab={setTab} />
    </section>
  )
}
