import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { app, BrowserWindow, nativeTheme, shell, type TitleBarOverlayOptions } from 'electron'
import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null
/** Set once a real quit starts, so closing the window stops hiding it to the tray. */
let quitting = false
/** Zoom applied to the window now and to any window recreated later. */
let zoomFactor = 1

/** Height of the toolbar, which doubles as the title bar, in CSS pixels before zoom, without its bottom border. */
const toolbarHeight = 64 - 1
/** The app's --background and --foreground from index.css as sRGB, since the overlay takes no oklch. */
const titleBarColors = {
  light: { color: '#f0f0f0', symbolColor: '#0a0a0a' },
  dark: { color: '#0c0c0c', symbolColor: '#fafafa' },
} as const

/** Native window buttons drawn over the toolbar in its colours, stopping short of its bottom border at any zoom. */
const titleBarOverlay = (): TitleBarOverlayOptions => ({
  ...titleBarColors[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'],
  height: Math.round(toolbarHeight * zoomFactor),
})

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
    backgroundColor: titleBarColors.dark.color,
    // the toolbar takes the place of the title bar, with Windows still drawing its own window buttons over it
    titleBarStyle: 'hidden',
    titleBarOverlay: titleBarOverlay(),
    // macOS draws its traffic lights at the left end instead, centred here on the toolbar
    trafficLightPosition: { x: 20, y: 24 },
    icon,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      zoomFactor,
    },
  })

  // the app has no menu bar, so Alt must not reveal Electron's default File/Edit/View/Window menu
  window.removeMenu()
  // the default menu also carried the reload shortcut, so development gets Ctrl+R back by hand
  if (is.dev)
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.control && !input.shift && input.key.toLowerCase() === 'r') {
        event.preventDefault()
        window.webContents.reload()
      }
    })
  if (show) window.once('ready-to-show', () => window.show())

  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    window.hide()
  })
  const updateOverlay = () => window.setTitleBarOverlay(titleBarOverlay())
  nativeTheme.on('updated', updateOverlay)
  window.on('closed', () => {
    nativeTheme.off('updated', updateOverlay)
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
  mainWindow?.setTitleBarOverlay(titleBarOverlay())
}

export const isMainWindowVisible = () => mainWindow?.isVisible() === true
