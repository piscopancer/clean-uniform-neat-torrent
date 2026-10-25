import { Context, Effect, Layer } from 'effect'
import WebTorrent from 'webtorrent'
import { messageOf, TorrentEngineError } from '@shared/errors'

const make = Effect.acquireRelease(
  Effect.try({
    try: () => new WebTorrent({ utp: true, dht: true, lsd: true, natUpnp: true }),
    catch: (cause) => new TorrentEngineError({ message: messageOf(cause) }),
  }).pipe(
    Effect.tap((client) =>
      Effect.sync(() => client.on('error', (error) => console.error('[webtorrent]', messageOf(error)))),
    ),
  ),
  (client) =>
    Effect.callback<void>((resume) => {
      client.destroy(() => resume(Effect.void))
    }),
)

/** The single webtorrent engine, created once per runtime and destroyed when the runtime is disposed. */
export class TorrentClient extends Context.Service<TorrentClient, WebTorrent>()('TorrentClient', { make }) {}

export const TorrentClientLive = Layer.effect(TorrentClient, TorrentClient.make)
