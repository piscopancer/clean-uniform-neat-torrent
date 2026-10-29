import { isAbsolute } from 'node:path'
import type { MainRuntime } from './runtime'
import { Broadcaster } from './services/broadcaster'

const isMagnetArg = (arg: string) => arg.toLowerCase().startsWith('magnet:')

const isTorrentArg = (arg: string) => isAbsolute(arg) && arg.toLowerCase().endsWith('.torrent')

/** Keeps only the arguments the OS passes for magnet links and .torrent files, dropping Electron's own flags and paths. */
export const torrentArgs = (argv: ReadonlyArray<string>) => argv.filter((arg) => isMagnetArg(arg) || isTorrentArg(arg))

/**
 * Buffers launch arguments until the renderer first takes them, since the OS can deliver them before the app is ready
 * or the window has loaded; after that each new batch is pushed straight to the renderer, which opens the add dialogs.
 */
const makeLaunchQueue = () => {
  let runtime: MainRuntime | null = null
  let rendererReady = false
  const pending: Array<string> = []

  const flush = () => {
    if (runtime === null || !rendererReady || pending.length === 0) return
    void runtime.runPromise(Broadcaster.use((broadcaster) => broadcaster.send('launchArgs', pending.splice(0))))
  }

  return {
    /** Queues raw arguments, ignoring anything that is not a magnet link or a .torrent path; returns whether any matched. */
    push: (argv: ReadonlyArray<string>) => {
      const args = torrentArgs(argv)
      pending.push(...args)
      flush()
      return args.length > 0
    },
    attach: (ready: MainRuntime) => {
      runtime = ready
      flush()
    },
    /** Hands over everything buffered so far and switches to pushing later arguments as events. */
    take: () => {
      rendererReady = true
      return pending.splice(0)
    },
  } as const
}

export const launchQueue = makeLaunchQueue()
