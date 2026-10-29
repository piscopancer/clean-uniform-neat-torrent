import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, dialog } from 'electron'
import { Cause, Exit } from 'effect'
import { registerIpc } from './ipc/register'
import { launchQueue } from './launch-args'
import { makeRuntime } from './runtime'
import { SettingsService } from './services/settings-service'
import { createTray } from './tray'
import { markQuitting, openMainWindow, setMainWindowZoom, showMainWindow } from './window'
import { watchZoom } from './zoom'

const start = async () => {
  electronApp.setAppUserModelId('com.cleanuniformneattorrent.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  if (app.isPackaged) app.setAsDefaultProtocolClient('magnet')

  const runtime = makeRuntime()
  const built = await runtime.runPromiseExit(runtime.contextEffect)
  if (Exit.isFailure(built)) {
    dialog.showErrorBox('Clean Uniform Neat Torrent failed to start', Cause.pretty(built.cause))
    app.exit(1)
    return
  }
  registerIpc(runtime)
  app.on('browser-window-created', (_, window) => watchZoom(runtime, window))

  // services flush the session and destroy the engine in their finalizers, so quitting waits for disposal once
  let disposed = false
  app.on('before-quit', (event) => {
    markQuitting()
    if (disposed) return
    event.preventDefault()
    disposed = true
    void runtime.dispose().finally(() => app.quit())
  })

  const settings = await runtime.runPromise(SettingsService.use((service) => service.get))
  setMainWindowZoom(settings.zoomFactor)
  const opensTorrent = launchQueue.push(process.argv)
  openMainWindow(!settings.startMinimized || opensTorrent)
  createTray()
  launchQueue.attach(runtime)
  app.on('activate', showMainWindow)
}

if (app.requestSingleInstanceLock()) {
  app.on('second-instance', (_, argv) => {
    launchQueue.push(argv)
    if (app.isReady()) showMainWindow()
  })
  // macOS delivers magnet links and opened files as events, possibly before the app is ready
  app.on('open-url', (event, url) => {
    event.preventDefault()
    launchQueue.push([url])
  })
  app.on('open-file', (event, path) => {
    event.preventDefault()
    launchQueue.push([path])
  })
  // closing the window hides it to the tray, so the app keeps running until Quit is chosen
  app.on('window-all-closed', () => {})
  void app.whenReady().then(start)
} else {
  app.quit()
}
