import { app, Menu, nativeImage, Tray } from 'electron'
import trayIcon from '../../resources/tray.png?asset'
import { isMainWindowVisible, showMainWindow, toggleMainWindow } from './window'

/** Creates the tray icon; the menu is rebuilt on open so "Show" or "Hide" matches the window state. */
export const createTray = () => {
  const tray = new Tray(nativeImage.createFromPath(trayIcon))
  tray.setToolTip(app.getName())

  const menu = () =>
    Menu.buildFromTemplate([
      { label: isMainWindowVisible() ? 'Hide' : 'Show', click: toggleMainWindow },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])

  tray.on('click', showMainWindow)
  tray.on('right-click', () => tray.popUpContextMenu(menu()))
  // Linux trays ignore click events and only show a context menu set up front.
  if (process.platform === 'linux') tray.setContextMenu(menu())
  return tray
}
