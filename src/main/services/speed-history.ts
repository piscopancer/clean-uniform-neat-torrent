import { Context, Effect, Layer, Stream } from 'effect'
import { speedHistoryMinutes, type InfoHash, type SpeedSample } from '@shared/schemas'
import { TorrentService } from './torrent-service'

const windowMs = speedHistoryMinutes * 60_000

/** Keeps the speeds of every torrent over the last hour in memory, so the chart has history the moment it opens. */
const make = Effect.gen(function* () {
  const torrents = yield* TorrentService
  const samples = new Map<InfoHash, Array<SpeedSample>>()

  yield* torrents.progress.pipe(
    Stream.runForEach((snapshot) =>
      Effect.sync(() => {
        const time = Date.now()
        const present = new Set<InfoHash>()
        for (const { infoHash, downloadSpeed, uploadSpeed } of snapshot.torrents) {
          present.add(infoHash)
          const list = samples.get(infoHash) ?? []
          list.push({ time, downloadSpeed, uploadSpeed })
          const firstKept = list.findIndex((sample) => sample.time > time - windowMs)
          if (firstKept > 0) list.splice(0, firstKept)
          samples.set(infoHash, list)
        }
        // removed torrents take their history with them
        for (const infoHash of samples.keys()) if (!present.has(infoHash)) samples.delete(infoHash)
      }),
    ),
    Effect.forkScoped,
  )

  return {
    /** Samples of one torrent, oldest first; empty for an unknown torrent. */
    of: (infoHash: InfoHash) => Effect.sync(() => [...(samples.get(infoHash) ?? [])]),
  } as const
})

export class SpeedHistory extends Context.Service<SpeedHistory, Effect.Success<typeof make>>()('SpeedHistory', {
  make,
}) {}

export const SpeedHistoryLive = Layer.effect(SpeedHistory, SpeedHistory.make)
