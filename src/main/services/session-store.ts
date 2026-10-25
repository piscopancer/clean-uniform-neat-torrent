import { join } from 'node:path'
import { app } from 'electron'
import { Context, Effect, Layer, Schema } from 'effect'
import { Bytes, FileEntry, FileIndex, Fraction, InfoHash } from '@shared/schemas'
import { readJsonFile, writeJsonFile } from '../lib/fs'

/** Everything needed to bring a torrent back after a restart, including the last known progress for paused ones. */
export const TorrentRecord = Schema.Struct({
  infoHash: InfoHash,
  name: Schema.String,
  magnetURI: Schema.String,
  torrentFile: Schema.NullOr(Schema.Uint8ArrayFromBase64),
  savePath: Schema.String,
  addedAt: Schema.Number,
  paused: Schema.Boolean,
  selectedFiles: Schema.NullOr(Schema.Array(FileIndex)),
  received: Bytes,
  uploaded: Bytes,
  size: Bytes,
  progress: Fraction,
  downloaded: Bytes,
  files: Schema.Array(FileEntry),
})
export type TorrentRecord = typeof TorrentRecord.Type

const SessionFile = Schema.Struct({ version: Schema.Literal(1), torrents: Schema.Array(TorrentRecord) })

const make = Effect.gen(function* () {
  const file = join(app.getPath('userData'), 'session.json')

  return {
    load: readJsonFile(file, SessionFile).pipe(
      Effect.map((session) => session?.torrents ?? []),
      Effect.catchTag('PersistenceError', (error) =>
        Effect.logWarning('Session file is unreadable, starting empty', error.message).pipe(Effect.as([])),
      ),
    ),
    save: (torrents: ReadonlyArray<TorrentRecord>) => writeJsonFile(file, SessionFile, { version: 1, torrents }),
  } as const
})

export class SessionStore extends Context.Service<SessionStore, Effect.Success<typeof make>>()('SessionStore', {
  make,
}) {}

export const SessionStoreLive = Layer.effect(SessionStore, SessionStore.make)
