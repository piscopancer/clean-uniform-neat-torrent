import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null
/** Set once a real quit starts, so closing the window stops hiding it to the tray. */
let quitting = false
/** Zoom applied to the window now and to any window recreated later. */
let zoomFactor = 1

export const markQuitting = () => {
  quitting = true
}

const createMainWindow = (show: boolean) => {
  const window = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 820,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    icon,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      zoomFactor,
    },
  })

  if (show) window.once('ready-to-show', () => window.show())

  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    window.hide()
  })
  window.on('closed', () => {
    mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // The renderer is a single page, so any navigation (for example a file dropped outside the drop handler) is blocked.
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl !== undefined) void window.loadURL(devUrl)
  else void window.loadFile(join(import.meta.dirname, '../renderer/index.html'))

  mainWindow = window
  return window
}

/** Creates the window on first launch, hidden when the app should start in the tray. */
export const openMainWindow = (show: boolean) => mainWindow ?? createMainWindow(show)

/** Brings the window to the front, recreating it if it was destroyed. */
export const showMainWindow = () => {
  const window = mainWindow ?? createMainWindow(true)
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  if (process.platform === 'darwin') app.dock?.show()
}

export const toggleMainWindow = () => {
  if (mainWindow?.isVisible() === true && !mainWindow.isMinimized()) mainWindow.hide()
  else showMainWindow()
}

export const setMainWindowZoom = (factor: number) => {
  zoomFactor = factor
  mainWindow?.webContents.setZoomFactor(factor)
}

export const isMainWindowVisible = () => mainWindow?.isVisible() === true
