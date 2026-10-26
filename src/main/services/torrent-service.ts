import { readFile, rm, rmdir, stat } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { Context, Effect, Exit, Layer, PubSub, Schema, Semaphore, Stream, SubscriptionRef } from 'effect'
import parseTorrent from 'parse-torrent'
import type { Torrent } from 'webtorrent'
import {
  DuplicateTorrentError,
  InvalidMagnetError,
  InvalidTorrentFileError,
  messageOf,
  TorrentEngineError,
  TorrentNotFoundError,
} from '@shared/errors'
import {
  InfoHash,
  peerTypes,
  type FileEntry,
  type PeerInfo,
  type PeerType,
  type ProgressSnapshot,
  type TorrentCompleted,
  type TorrentDetails,
  type TorrentStatus,
  type TorrentSummary,
} from '@shared/schemas'
import { ensureDirectory } from '../lib/fs'
import { SessionStore, type TorrentRecord } from './session-store'
import { SettingsService } from './settings-service'
import { TorrentClient, TorrentClientLive } from './torrent-client'

/** Largest .torrent file accepted; real metainfo files are a few hundred KiB at most. */
const maxTorrentFileBytes = 16 * 1024 * 1024
/** Rate value that tells webtorrent to disable throttling. */
const unlimitedRate = -1
const progressInterval = '1 second'
const sessionSaveDebounce = '1 second'
/** Periodic save so transfer statistics survive a crash. */
const sessionSaveInterval = '1 minute'

type Entry = {
  readonly infoHash: InfoHash
  readonly addedAt: number
  name: string
  magnetURI: string
  torrentFile: Uint8Array | null
  savePath: string
  paused: boolean
  /** Selected file indices, null meaning every file. */
  selected: ReadonlySet<number> | null
  torrent: Torrent | null
  error: string | null
  /** Whether the selected files were complete at the last check; drives completion notifications. */
  completed: boolean
  /** Byte counters from earlier runs, since webtorrent resets them for every new Torrent instance. */
  carried: { received: number; uploaded: number }
  /** Last known file state, shown while the torrent is paused, verifying or waiting for metadata. */
  files: ReadonlyArray<FileEntry>
}

export type ParsedSource = {
  readonly infoHash: InfoHash
  readonly name: string
  readonly magnetURI: string
  readonly torrentFile: Uint8Array | null
}

export const clampFraction = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

const readyTorrent = (entry: Entry) => (entry.torrent?.ready ? entry.torrent : null)

const isSelected = (entry: Entry, index: number) => entry.selected?.has(index) ?? true

const liveFiles = (entry: Entry, torrent: Torrent) =>
  torrent.files.map((file, index): FileEntry => ({
    index,
    name: file.name,
    path: file.path,
    length: file.length,
    downloaded: file.downloaded,
    progress: clampFraction(file.progress),
    selected: isSelected(entry, index),
  }))

/** Current files of an entry, refreshing the cached copy when the torrent is live. */
const currentFiles = (entry: Entry) => {
  const torrent = readyTorrent(entry)
  if (torrent) entry.files = liveFiles(entry, torrent)
  return entry.files
}

export const selectionTotals = (files: ReadonlyArray<FileEntry>) => {
  const selected = files.filter((file) => file.selected)
  const size = selected.reduce((sum, file) => sum + file.length, 0)
  const downloaded = selected.reduce((sum, file) => sum + Math.min(file.downloaded, file.length), 0)
  return { size, downloaded, done: files.length > 0 && downloaded >= size }
}

/** Path that best represents the downloaded content: the single file or the torrent's root folder. */
export const contentPathOf = (savePath: string, files: ReadonlyArray<FileEntry>) => {
  const [first] = files
  if (!first) return savePath
  return files.length === 1 ? join(savePath, first.path) : join(savePath, first.path.split(/[\\/]/)[0] ?? '')
}

const transferTotals = (entry: Entry) => ({
  received: entry.carried.received + (entry.torrent?.received ?? 0),
  uploaded: entry.carried.uploaded + (entry.torrent?.uploaded ?? 0),
})

const statusOf = (entry: Entry, done: boolean): TorrentStatus => {
  if (entry.error !== null) return 'error'
  if (entry.paused) return 'paused'
  if (!readyTorrent(entry)) return 'metadata'
  return done ? 'seeding' : 'downloading'
}

const summarize = (entry: Entry) => {
  const files = currentFiles(entry)
  const { size, downloaded, done } = selectionTotals(files)
  const status = statusOf(entry, done)
  const { received, uploaded } = transferTotals(entry)
  const live = entry.torrent
  const downloadSpeed = live?.downloadSpeed ?? 0
  return {
    infoHash: entry.infoHash,
    name: entry.name,
    size,
    progress: size > 0 ? clampFraction(downloaded / size) : done ? 1 : 0,
    status,
    downloadSpeed,
    uploadSpeed: live?.uploadSpeed ?? 0,
    numPeers: live?.numPeers ?? 0,
    eta: status === 'downloading' && downloadSpeed > 0 ? (size - downloaded) / downloadSpeed : null,
    ratio: uploaded / Math.max(received, downloaded, 1),
    downloaded,
    uploaded,
    savePath: entry.savePath,
    addedAt: entry.addedAt,
    error: entry.error,
  } satisfies TorrentSummary
}

const toRecord = (entry: Entry) => {
  const files = currentFiles(entry)
  const { size, downloaded } = selectionTotals(files)
  return {
    infoHash: entry.infoHash,
    name: entry.name,
    magnetURI: entry.magnetURI,
    torrentFile: entry.torrentFile,
    savePath: entry.savePath,
    addedAt: entry.addedAt,
    paused: entry.paused,
    selectedFiles: entry.selected ? [...entry.selected] : null,
    ...transferTotals(entry),
    size,
    progress: size > 0 ? clampFraction(downloaded / size) : 0,
    downloaded,
    files,
  } satisfies TorrentRecord
}

const fromRecord = (record: TorrentRecord): Entry => ({
  infoHash: record.infoHash,
  addedAt: record.addedAt,
  name: record.name,
  magnetURI: record.magnetURI,
  torrentFile: record.torrentFile,
  savePath: record.savePath,
  paused: record.paused,
  selected: record.selectedFiles ? new Set(record.selectedFiles) : null,
  torrent: null,
  error: null,
  completed: selectionTotals(record.files).done,
  carried: { received: record.received, uploaded: record.uploaded },
  files: record.files,
})

/** Restricts downloading to the selected files; everything is deselected first because ranges of adjacent files overlap. */
const applySelection = (entry: Entry, torrent: Torrent) => {
  if (torrent.pieces.length > 0) torrent.deselect(0, torrent.pieces.length - 1)
  torrent.files.forEach((file, index) => {
    if (isSelected(entry, index)) file.select()
  })
}

const destroyTorrent = (torrent: Torrent, destroyStore: boolean) =>
  Effect.callback<void, TorrentEngineError>((resume) => {
    torrent.destroy({ destroyStore }, (error) =>
      resume(error ? Effect.fail(new TorrentEngineError({ message: messageOf(error) })) : Effect.void),
    )
  })

/** Deletes the files of a torrent that is not loaded in the engine, then any directories left empty. */
const deleteStoredFiles = (entry: Entry) =>
  Effect.promise(async () => {
    const paths = entry.files.map((file) => join(entry.savePath, file.path))
    await Promise.all(paths.map((path) => rm(path, { force: true })))
    const directories = new Set(
      paths.flatMap((path) => {
        const parents: Array<string> = []
        for (let parent = dirname(path); parent.startsWith(entry.savePath + sep); parent = dirname(parent)) {
          parents.push(parent)
        }
        return parents
      }),
    )
    const deepestFirst = [...directories].sort((a, b) => b.length - a.length)
    for (const directory of deepestFirst) await rmdir(directory).catch(() => undefined)
  })

const peerClients = {
  qB: 'qBittorrent',
  TR: 'Transmission',
  UT: 'µTorrent',
  UM: 'µTorrent Mac',
  LT: 'libtorrent',
  lt: 'rTorrent',
  DE: 'Deluge',
  WW: 'WebTorrent',
  WD: 'WebTorrent Desktop',
  BT: 'BitTorrent',
  AZ: 'Vuze',
  BI: 'BiglyBT',
  TL: 'Tribler',
  FD: 'Free Download Manager',
} as const satisfies Record<string, string>

const isPeerClientCode = (code: string): code is keyof typeof peerClients => code in peerClients

/** Names the client from an Azureus-style peer id such as -qB4650-. */
const peerClientName = (peerIdHex: string) => {
  const id = Buffer.from(peerIdHex, 'hex').toString('latin1')
  const match = /^-([A-Za-z~]{2})([0-9A-Za-z]{4})-/.exec(id)
  if (!match) return 'Unknown'
  const [, code = '', version = ''] = match
  const name = isPeerClientCode(code) ? peerClients[code] : code
  return `${name} ${version.split('').join('.')}`
}

const isPeerType = (type: string): type is PeerType => peerTypes.some((known) => known === type)

const peerTypeOf = (type: string): PeerType =>
  type.startsWith('utp') ? 'utp' : isPeerType(type) ? type : 'tcpOutgoing'

/** Reads a throughput meter of bittorrent-protocol, which the wire typings leave as any. */
const meterValue = (meter: unknown) => {
  if (typeof meter !== 'function') return 0
  const value: unknown = meter()
  return typeof value === 'number' ? value : 0
}

const hasBitfield = (value: unknown): value is { get: (index: number) => unknown } =>
  typeof value === 'object' && value !== null && 'get' in value && typeof value.get === 'function'

const peersOf = (torrent: Torrent) =>
  torrent.wires.map((wire): PeerInfo => {
    const address: unknown = wire.remoteAddress
    const port: unknown = wire.remotePort
    const pieces: unknown = wire.peerPieces
    const pieceCount = torrent.pieces.length
    let have = 0
    if (hasBitfield(pieces)) for (let index = 0; index < pieceCount; index++) if (pieces.get(index)) have++
    const type: string = wire.type
    return {
      id: wire.peerId,
      address: typeof address === 'string' ? (port === undefined ? address : `${address}:${String(port)}`) : '',
      client: peerClientName(wire.peerId),
      type: peerTypeOf(type),
      progress: pieceCount > 0 ? have / pieceCount : 0,
      downloadSpeed: meterValue(wire.downloadSpeed),
      uploadSpeed: meterValue(wire.uploadSpeed),
    }
  })

const decodeInfoHash = Schema.decodeUnknownEffect(InfoHash)

export const parseMagnet = (magnet: string) =>
  Effect.gen(function* () {
    const invalid = new InvalidMagnetError({ magnet })
    const trimmed = magnet.trim()
    if (!trimmed.toLowerCase().startsWith('magnet:')) return yield* invalid
    const parsed = yield* Effect.tryPromise({ try: () => parseTorrent(trimmed), catch: () => invalid })
    const infoHash = yield* decodeInfoHash(parsed.infoHash).pipe(Effect.mapError(() => invalid))
    const name = parsed.name ?? (typeof parsed.dn === 'string' ? parsed.dn : infoHash)
    return { infoHash, name, magnetURI: trimmed, torrentFile: null } satisfies ParsedSource
  })

export const parseTorrentFile = (path: string) =>
  Effect.gen(function* () {
    const invalid = (reason: string) => new InvalidTorrentFileError({ path, reason })
    const stats = yield* Effect.tryPromise({ try: () => stat(path), catch: (cause) => invalid(messageOf(cause)) })
    if (!stats.isFile()) return yield* invalid('Not a file')
    if (stats.size > maxTorrentFileBytes) return yield* invalid('File is too large to be a torrent')
    const contents = yield* Effect.tryPromise({
      try: () => readFile(path),
      catch: (cause) => invalid(messageOf(cause)),
    })
    const torrentFile = new Uint8Array(contents)
    const parsed = yield* Effect.tryPromise({
      try: () => parseTorrent(torrentFile),
      catch: (cause) => invalid(messageOf(cause)),
    })
    if (!parsed.infoBuffer) return yield* invalid('The file contains no torrent metadata')
    const infoHash = yield* decodeInfoHash(parsed.infoHash).pipe(Effect.mapError(() => invalid('Invalid info hash')))
    const magnetURI = `magnet:?xt=urn:btih:${infoHash}`
    return { infoHash, name: parsed.name ?? infoHash, magnetURI, torrentFile } satisfies ParsedSource
  })

const make = Effect.gen(function* () {
  const client = yield* TorrentClient
  const settings = yield* SettingsService
  const store = yield* SessionStore

  const entries = new Map<InfoHash, Entry>()
  const dirty = yield* PubSub.unbounded<void>()
  const completions = yield* PubSub.unbounded<TorrentCompleted>()
  const markDirty = () => PubSub.publishUnsafe(dirty, undefined)

  const snapshot = () => {
    const torrents = [...entries.values()].map(summarize)
    return {
      torrents,
      downloadSpeed: torrents.reduce((sum, torrent) => sum + torrent.downloadSpeed, 0),
      uploadSpeed: torrents.reduce((sum, torrent) => sum + torrent.uploadSpeed, 0),
    } satisfies ProgressSnapshot
  }
  const progress = yield* SubscriptionRef.make<ProgressSnapshot>(snapshot())

  const lookup = (infoHash: InfoHash) =>
    Effect.suspend(() => {
      const entry = entries.get(infoHash)
      return entry ? Effect.succeed(entry) : Effect.fail(new TorrentNotFoundError({ infoHash }))
    })
  const lookupAll = (infoHashes: ReadonlyArray<InfoHash>) => Effect.forEach(infoHashes, lookup)

  /** Loads the entry into the engine; webtorrent reuses and re-verifies any data already on disk. */
  const start = (entry: Entry) =>
    Effect.try({
      try: () => {
        entry.error = null
        entry.paused = false
        const torrent = client.add(entry.torrentFile ?? entry.magnetURI, { path: entry.savePath, deselect: true })
        entry.torrent = torrent
        torrent.on('metadata', () => {
          entry.name = torrent.name
          entry.magnetURI = torrent.magnetURI
          entry.torrentFile = torrent.torrentFile
          markDirty()
        })
        torrent.on('ready', () => {
          applySelection(entry, torrent)
          entry.completed = selectionTotals(currentFiles(entry)).done
          markDirty()
        })
        torrent.on('error', (error) => {
          if (entry.torrent !== torrent) return
          entry.carried = transferTotals(entry)
          entry.torrent = null
          entry.error = messageOf(error)
          markDirty()
        })
      },
      catch: (cause) => {
        entry.torrent = null
        entry.error = messageOf(cause)
        return new TorrentEngineError({ message: entry.error })
      },
    })

  /** Removes the live torrent from the engine, keeping its last state and counters on the entry. */
  const unload = (entry: Entry, destroyStore: boolean) =>
    Effect.suspend(() => {
      const torrent = entry.torrent
      if (!torrent) return Effect.void
      currentFiles(entry)
      entry.carried = transferTotals(entry)
      entry.torrent = null
      return destroyTorrent(torrent, destroyStore)
    })

  const add = Effect.fn('TorrentService.add')(function* (source: ParsedSource, savePath: string | undefined) {
    const folder = savePath ?? (yield* settings.get).downloadFolder
    yield* ensureDirectory(folder)
    const existing = entries.get(source.infoHash)
    if (existing) return yield* new DuplicateTorrentError({ infoHash: existing.infoHash, name: existing.name })
    const entry: Entry = {
      ...source,
      addedAt: Date.now(),
      savePath: folder,
      paused: false,
      selected: null,
      torrent: null,
      error: null,
      completed: false,
      carried: { received: 0, uploaded: 0 },
      files: [],
    }
    entries.set(entry.infoHash, entry)
    markDirty()
    yield* start(entry)
    return summarize(entry)
  })

  const pause = Effect.fn('TorrentService.pause')(function* (infoHashes: ReadonlyArray<InfoHash>) {
    for (const entry of yield* lookupAll(infoHashes)) {
      entry.paused = true
      entry.error = null
      yield* unload(entry, false)
    }
    markDirty()
  })

  const resume = Effect.fn('TorrentService.resume')(function* (infoHashes: ReadonlyArray<InfoHash>) {
    for (const entry of yield* lookupAll(infoHashes)) {
      if (entry.torrent) continue
      const folder = yield* Effect.exit(ensureDirectory(entry.savePath))
      if (Exit.isFailure(folder)) {
        entry.error = `Save folder is missing: ${entry.savePath}`
        markDirty()
        return yield* folder
      }
      yield* start(entry)
    }
    markDirty()
  })

  const remove = Effect.fn('TorrentService.remove')(function* (
    infoHashes: ReadonlyArray<InfoHash>,
    deleteFiles: boolean,
  ) {
    for (const entry of yield* lookupAll(infoHashes)) {
      entries.delete(entry.infoHash)
      if (entry.torrent) yield* unload(entry, deleteFiles)
      else if (deleteFiles) yield* deleteStoredFiles(entry)
    }
    markDirty()
  })

  const selectFiles = Effect.fn('TorrentService.selectFiles')(function* (
    infoHash: InfoHash,
    selected: ReadonlyArray<number>,
  ) {
    const entry = yield* lookup(infoHash)
    const count = currentFiles(entry).length
    if (count === 0)
      return yield* new TorrentEngineError({ message: 'The file list is not known until metadata arrives' })
    if (selected.some((index) => index >= count))
      return yield* new TorrentEngineError({ message: 'File index out of range' })
    const chosen = new Set(selected)
    entry.selected = chosen.size === count ? null : chosen
    entry.files = entry.files.map((file) => ({ ...file, selected: isSelected(entry, file.index) }))
    const torrent = readyTorrent(entry)
    if (torrent) applySelection(entry, torrent)
    entry.completed = selectionTotals(currentFiles(entry)).done
    markDirty()
  })

  const details = Effect.fn('TorrentService.details')(function* (infoHash: InfoHash) {
    const entry = yield* lookup(infoHash)
    const summary = summarize(entry)
    const torrent = readyTorrent(entry)
    return {
      summary,
      magnetURI: entry.magnetURI,
      comment: torrent?.comment ?? '',
      pieceCount: torrent?.pieces.length ?? 0,
      pieceLength: torrent?.pieceLength ?? 0,
      totalSize: entry.files.reduce((sum, file) => sum + file.length, 0),
      files: entry.files,
      peers: entry.torrent ? peersOf(entry.torrent) : [],
    } satisfies TorrentDetails
  })

  const contentPath = Effect.fn('TorrentService.contentPath')(function* (infoHash: InfoHash) {
    const entry = yield* lookup(infoHash)
    return contentPathOf(entry.savePath, entry.files)
  })

  const tick = Effect.gen(function* () {
    const next = snapshot()
    for (const summary of next.torrents) {
      const entry = entries.get(summary.infoHash)
      if (!entry) continue
      const done = summary.status === 'seeding'
      if (done && !entry.completed) {
        yield* PubSub.publish(completions, { infoHash: entry.infoHash, name: entry.name })
        markDirty()
      }
      if (readyTorrent(entry)) entry.completed = done
    }
    yield* SubscriptionRef.set(progress, next)
  })

  const saveLock = yield* Semaphore.make(1)
  const saveSession = Effect.suspend(() => store.save([...entries.values()].map(toRecord))).pipe(
    Effect.catchTag('PersistenceError', (error) => Effect.logWarning('Session save failed', error.message)),
    saveLock.withPermit,
  )

  for (const record of yield* store.load) {
    const entry = fromRecord(record)
    entries.set(entry.infoHash, entry)
    if (entry.paused) continue
    const folder = yield* Effect.exit(ensureDirectory(entry.savePath))
    if (Exit.isFailure(folder)) entry.error = `Save folder is missing: ${entry.savePath}`
    else yield* start(entry).pipe(Effect.ignore)
  }

  yield* settings.changes.pipe(
    Stream.runForEach((current) =>
      Effect.sync(() => {
        client.throttleDownload(current.downloadLimit ?? unlimitedRate)
        client.throttleUpload(current.uploadLimit ?? unlimitedRate)
      }),
    ),
    Effect.forkScoped,
  )
  yield* Stream.tick(progressInterval).pipe(
    Stream.runForEach(() => tick),
    Effect.forkScoped,
  )
  yield* Stream.merge(Stream.fromPubSub(dirty), Stream.tick(sessionSaveInterval)).pipe(
    Stream.debounce(sessionSaveDebounce),
    Stream.runForEach(() => saveSession),
    Effect.forkScoped,
  )
  yield* Effect.addFinalizer(() => saveSession)

  return {
    list: Effect.sync(snapshot),
    addMagnet: (magnet: string, savePath?: string) =>
      parseMagnet(magnet).pipe(Effect.flatMap((source) => add(source, savePath))),
    addFile: (path: string, savePath?: string) =>
      parseTorrentFile(path).pipe(Effect.flatMap((source) => add(source, savePath))),
    pause,
    resume,
    remove,
    selectFiles,
    details,
    contentPath,
    /** Every torrent's info hash, for tray actions that apply to all of them. */
    infoHashes: Effect.sync(() => [...entries.keys()]),
    /** Latest snapshot followed by one per second. */
    progress: SubscriptionRef.changes(progress),
    /** Emits once each time a torrent's selected files finish downloading. */
    completions: Stream.fromPubSub(completions),
  } as const
})

export class TorrentService extends Context.Service<TorrentService, Effect.Success<typeof make>>()('TorrentService', {
  make,
}) {}

/** The webtorrent-backed service; the engine is provided here so the fixture service never starts one. */
export const TorrentServiceLive = Layer.effect(TorrentService, TorrentService.make).pipe(
  Layer.provide(TorrentClientLive),
)
