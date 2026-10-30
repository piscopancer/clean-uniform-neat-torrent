import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { eventChannel } from '@shared/channels'
import { pathStyleOf } from '@shared/paths'
import type {
  CommandArgs,
  CommandName,
  CommandOutputEncoded,
  EventName,
  EventPayloadEncoded,
  IpcResult,
} from '@shared/contract'

/** Returns a subscriber for one push event; each subscription yields its own unsubscribe function. */
const subscribe =
  <K extends EventName>(name: K) =>
  (listener: (payload: EventPayloadEncoded<K>) => void) => {
    const channel = eventChannel(name)
    // main encodes every payload with the event's contract schema before sending it
    const handler = (_event: IpcRendererEvent, payload: EventPayloadEncoded<K>) => listener(payload)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  }

const api = {
  invoke: <K extends CommandName>(name: K, ...args: CommandArgs<K>) => {
    // main always resolves with an IpcResult encoded from this command's output schema
    const result: Promise<IpcResult<CommandOutputEncoded<K>>> = ipcRenderer.invoke(name, ...args)
    return result
  },
  onProgress: subscribe('progress'),
  onUpdateStatus: subscribe('updateStatus'),
  onTorrentCompleted: subscribe('torrentCompleted'),
  onBackgroundError: subscribe('backgroundError'),
  onAccentColor: subscribe('accentColor'),
  onLaunchArgs: subscribe('launchArgs'),
  /** Absolute path of a dropped file, which the sandboxed renderer cannot read from File itself. */
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  /** Path style of the OS, so the renderer checks typed folders the way main will. */
  pathStyle: pathStyleOf(process.platform),
} as const

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
