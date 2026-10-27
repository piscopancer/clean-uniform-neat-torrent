import { useEffect } from 'react'
import { AddFileDialog, AddMagnetDialog } from '@/components/add-dialogs'
import { DetailSheet } from '@/components/details/detail-sheet'
import { ListBar } from '@/components/list-bar'
import { MetalFilter } from '@/components/metal-filter'
import { RemoveDialog } from '@/components/remove-dialog'
import { SettingsDialog } from '@/components/settings-dialog'
import { StatusBar } from '@/components/status-bar'
import { Toolbar } from '@/components/toolbar'
import { TorrentView } from '@/components/torrent-view'
import { LiquidFilter } from '@/components/ui/progress'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAccent } from '@/hooks/use-accent'
import { useAppInput } from '@/hooks/use-app-input'
import { useTheme } from '@/hooks/use-theme'
import { applyUpdateStatus, loadSettings, loadUpdateStatus, refresh } from '@/lib/actions'
import { api } from '@/lib/api'
import { toasts } from '@/lib/toasts'
import { useDialogs } from '@/store/dialogs'
import { useExtraVisuals } from '@/store/settings'
import { applySnapshot } from '@/store/torrents'

/** Loads initial state and subscribes to main's push events for the lifetime of the window. */
const useMainEvents = () =>
  useEffect(() => {
    void refresh()
    void loadSettings()
    void loadUpdateStatus()
    const unsubscribers = [
      api.onProgress(applySnapshot),
      api.onTorrentCompleted(({ name }) => toasts.downloadComplete(name)),
      api.onBackgroundError(toasts.error),
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
  // a modal's frosted backdrop is redrawn whenever what lies behind it changes, so everything there stops moving
  const modalOpen = useDialogs((state) => state.dialog !== null)
  const extraVisuals = useExtraVisuals()
  return (
    <TooltipProvider delayDuration={400} disableHoverableContent>
      <main
        className="relative flex h-screen flex-col bg-background text-foreground"
        data-modal-open={modalOpen || undefined}
      >
        <Toolbar />
        <div className="flex min-h-0 flex-1 flex-col gap-1 p-2 pb-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden panel">
            <ListBar />
            <TorrentView />
          </div>
          <StatusBar />
        </div>
        {dragging && (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80 text-sm font-medium">
            Drop .torrent files or magnet links to add them
          </div>
        )}
      </main>
      <AddMagnetDialog />
      <AddFileDialog />
      <RemoveDialog />
      <SettingsDialog />
      <DetailSheet />
      {extraVisuals && <LiquidFilter paused={modalOpen} />}
      <MetalFilter />
      <Toaster position="bottom-right" theme={theme} />
    </TooltipProvider>
  )
}
