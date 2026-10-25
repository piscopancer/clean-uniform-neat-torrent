import { useEffect } from 'react'
import { toast } from 'sonner'
import { AddFilesDialog, AddMagnetDialog } from '@/components/add-dialogs'
import { DetailPanel } from '@/components/details/detail-panel'
import { RemoveDialog } from '@/components/remove-dialog'
import { SettingsDialog } from '@/components/settings-dialog'
import { StatusBar } from '@/components/status-bar'
import { Toolbar } from '@/components/toolbar'
import { TorrentView } from '@/components/torrent-view'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAccent } from '@/hooks/use-accent'
import { useAppInput } from '@/hooks/use-app-input'
import { useTheme } from '@/hooks/use-theme'
import { applyUpdateStatus, loadSettings, loadUpdateStatus, refresh } from '@/lib/actions'
import { api } from '@/lib/api'
import { toastError } from '@/lib/errors'
import { applySnapshot } from '@/store/torrents'

/** Loads initial state and subscribes to main's push events for the lifetime of the window. */
const useMainEvents = () =>
  useEffect(() => {
    void refresh()
    void loadSettings()
    void loadUpdateStatus()
    const unsubscribers = [
      api.onProgress(applySnapshot),
      api.onTorrentCompleted(({ name }) => toast.success('Download complete', { description: name })),
      api.onBackgroundError(toastError),
      api.onUpdateStatus(applyUpdateStatus),
    ]
    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
    }
  }, [])

export const App = () => {
  useMainEvents()
  const dragging = useAppInput()
  const theme = useTheme()
  useAccent()
  return (
    <TooltipProvider delayDuration={400}>
      <main className="relative flex h-screen flex-col bg-background text-foreground">
        <Toolbar />
        <TorrentView />
        <DetailPanel />
        <StatusBar />
        {dragging && (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/80 text-sm font-medium">
            Drop .torrent files or magnet links to add them
          </div>
        )}
      </main>
      <AddMagnetDialog />
      <AddFilesDialog />
      <RemoveDialog />
      <SettingsDialog />
      <Toaster position="bottom-right" theme={theme} />
    </TooltipProvider>
  )
}
