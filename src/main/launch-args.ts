import { isAbsolute } from 'node:path'
import { Effect } from 'effect'
import type { IpcError } from '@shared/errors'
import type { MainRuntime } from './runtime'
import { Broadcaster } from './services/broadcaster'
import { TorrentService } from './services/torrent-service'

type IpcErrorValue = typeof IpcError.Type

const isMagnetArg = (arg: string) => arg.toLowerCase().startsWith('magnet:')

const isTorrentArg = (arg: string) => isAbsolute(arg) && arg.toLowerCase().endsWith('.torrent')

/** Keeps only the arguments the OS passes for magnet links and .torrent files, dropping Electron's own flags and paths. */
export const torrentArgs = (argv: ReadonlyArray<string>) => argv.filter((arg) => isMagnetArg(arg) || isTorrentArg(arg))

/** Adds each magnet or file with the default folder; failures reach the renderer as background errors. */
const openArgs = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const torrents = yield* TorrentService
    const broadcaster = yield* Broadcaster
    yield* Effect.forEach(
      args,
      (arg) =>
        Effect.asVoid<unknown, IpcErrorValue, never>(
          isMagnetArg(arg) ? torrents.addMagnet(arg) : torrents.addFile(arg),
        ).pipe(Effect.catch((error) => broadcaster.send('backgroundError', error))),
      { discard: true },
    )
  })

/** Buffers launch arguments until the runtime exists, since the OS can deliver them before the app is ready. */
export const makeLaunchQueue = () => {
  let runtime: MainRuntime | null = null
  const pending: Array<string> = []

  const flush = () => {
    if (runtime === null || pending.length === 0) return
    void runtime.runPromise(openArgs(pending.splice(0)))
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
  } as const
}
