import { join } from 'node:path'
import { app } from 'electron'
import { Context, Effect, Layer, Schema } from 'effect'
import { Bytes, FileEntry, FileIndex, Fraction, InfoHash, TorrentSpeedLimit } from '@shared/schemas'
import { readJsonFile, writeJsonFile } from '../lib/fs'

/** A per-torrent limit, missing from sessions saved before such limits existed. */
const SavedLimit = TorrentSpeedLimit.pipe(Schema.withDecodingDefaultKey(Effect.succeed(null)))

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
  downloadLimit: SavedLimit,
  uploadLimit: SavedLimit,
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
