import { app, Menu, nativeImage, nativeTheme, Tray } from 'electron'
import eyeOffDark from '../../resources/menu/dark/eye-off.png?asset'
import eyeDark from '../../resources/menu/dark/eye.png?asset'
import powerDark from '../../resources/menu/dark/power.png?asset'
import eyeOffLight from '../../resources/menu/light/eye-off.png?asset'
import eyeLight from '../../resources/menu/light/eye.png?asset'
import powerLight from '../../resources/menu/light/power.png?asset'
import trayIcon from '../../resources/tray.png?asset'
import { isMainWindowVisible, showMainWindow, toggleMainWindow } from './window'

/** Lucide icons rendered for both menu themes; createFromPath also picks up the @2x file beside each one. */
const menuIcons = {
  light: { show: eyeLight, hide: eyeOffLight, quit: powerLight },
  dark: { show: eyeDark, hide: eyeOffDark, quit: powerDark },
} as const

const menuIcon = (name: keyof typeof menuIcons.light) =>
  nativeImage.createFromPath(menuIcons[nativeTheme.shouldUseDarkColors ? 'dark' : 'light'][name])

/** Creates the tray icon; the menu is rebuilt on open so "Show" or "Hide" matches the window state. */
export const createTray = () => {
  const image = nativeImage.createFromPath(trayIcon)
  // the 32px icon would fill the macOS menu bar, so it is drawn as a 16pt icon for Retina screens there
  const tray = new Tray(
    process.platform === 'darwin' ? nativeImage.createFromBuffer(image.toPNG(), { scaleFactor: 2 }) : image,
  )
  tray.setToolTip(app.getName())

  const menu = () =>
    Menu.buildFromTemplate([
      isMainWindowVisible()
        ? { label: 'Hide', icon: menuIcon('hide'), click: toggleMainWindow }
        : { label: 'Show', icon: menuIcon('show'), click: toggleMainWindow },
      { type: 'separator' },
      { label: 'Quit', icon: menuIcon('quit'), click: () => app.quit() },
    ])

  tray.on('click', showMainWindow)
  tray.on('right-click', () => tray.popUpContextMenu(menu()))
  // Linux trays ignore click events and only show a context menu set up front.
  if (process.platform === 'linux') tray.setContextMenu(menu())
  return tray
}
