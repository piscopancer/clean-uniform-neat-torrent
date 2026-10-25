import { BrowserWindow } from 'electron'
import { Context, Effect, Layer, Schema } from 'effect'
import { eventChannel } from '@shared/channels'
import { events, type EventName, type EventPayload } from '@shared/contract'

const make = Effect.succeed({
  /** Encodes a push event with its contract schema and sends it to every open window. */
  send: <K extends EventName>(name: K, payload: EventPayload<K>) =>
    Schema.encodeUnknownEffect(events[name])(payload).pipe(
      Effect.flatMap((encoded) =>
        Effect.sync(() => {
          for (const window of BrowserWindow.getAllWindows()) {
            if (!window.isDestroyed()) window.webContents.send(eventChannel(name), encoded)
          }
        }),
      ),
      Effect.orDie,
    ),
} as const)

export class Broadcaster extends Context.Service<Broadcaster, Effect.Success<typeof make>>()('Broadcaster', {
  make,
}) {}

export const BroadcasterLive = Layer.effect(Broadcaster, Broadcaster.make)
