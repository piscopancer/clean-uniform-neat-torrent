import { createHash } from 'node:crypto'
import { Duration, Effect, Layer, PubSub, Stream, SubscriptionRef } from 'effect'
import { DuplicateTorrentError, TorrentEngineError, TorrentNotFoundError } from '@shared/errors'
import {
  InfoHash,
  type FileEntry,
  type PeerInfo,
  type ProgressSnapshot,
  type TorrentCompleted,
  type TorrentDetails,
  type TorrentLimits,
  type TorrentStatus,
  type TorrentSummary,
} from '@shared/schemas'
import type { FixtureKind } from '../fixtures/list-flag'
import { checkSavePath } from '../lib/fs'
import { SettingsService } from './settings-service'
import {
  clampFraction,
  contentPathOf,
  parseMagnet,
  parseTorrentFile,
  selectionTotals,
  TorrentService,
  type ParsedSource,
} from './torrent-service'

const KiB = 1024
const MiB = 1024 * KiB
const GiB = 1024 * MiB

/** Shorter than the live one-second interval so the cycling fixture animates smoothly. */
const tickInterval = Duration.millis(250)
const tickSeconds = Duration.toSeconds(tickInterval)
/** Time the cycling fixture takes to go from empty to complete. */
const cycleDuration = Duration.seconds(5)
const pieceLength = 256 * KiB

type Fixture = {
  readonly name: string
  readonly files: ReadonlyArray<readonly [path: string, length: number]>
  /** Share of the bytes already on disk, filled file by file. */
  readonly progress: number
  readonly paused: boolean
  /** Bytes per second while downloading; ignored when the fixture cycles. */
  readonly downloadRate: number
  readonly uploadRate: number
  readonly uploaded: number
  readonly peers: number
  readonly cycles: boolean
  /** How long before launch the fixture was added. */
  readonly age: Duration.Duration
}

const fixtures = {
  completed: {
    name: 'ubuntu-24.04.3-desktop-amd64.iso',
    files: [['ubuntu-24.04.3-desktop-amd64.iso', 6 * GiB]],
    progress: 1,
    paused: true,
    downloadRate: 0,
    uploadRate: 300 * KiB,
    uploaded: 0,
    peers: 4,
    cycles: false,
    age: Duration.hours(72),
  },
  seeding: {
    name: 'Big Buck Bunny',
    files: [
      ['Big Buck Bunny/Big Buck Bunny.mp4', 263 * MiB],
      ['Big Buck Bunny/Big Buck Bunny.en.srt', 40 * KiB],
      ['Big Buck Bunny/poster.jpg', 310 * KiB],
    ],
    progress: 1,
    paused: false,
    downloadRate: 0,
    uploadRate: 850 * KiB,
    uploaded: 1.2 * GiB,
    peers: 12,
    cycles: false,
    age: Duration.hours(48),
  },
  stalled: {
    name: 'debian-13.1.0-amd64-DVD-1.iso',
    files: [['debian-13.1.0-amd64-DVD-1.iso', 3.7 * GiB]],
    progress: 0.37,
    paused: false,
    downloadRate: 0,
    uploadRate: 0,
    uploaded: 0,
    peers: 3,
    cycles: false,
    age: Duration.hours(24),
  },
  cycling: {
    name: 'Sintel',
    files: [
      ['Sintel/sintel-1080p.mkv', 1.1 * GiB],
      ['Sintel/sintel.en.srt', 60 * KiB],
    ],
    progress: 0,
    paused: false,
    downloadRate: 0,
    uploadRate: 120 * KiB,
    uploaded: 0,
    peers: 27,
    cycles: true,
    age: Duration.hours(5),
  },
  paused: {
    name: 'archlinux-2025.10.01-x86_64.iso',
    files: [['archlinux-2025.10.01-x86_64.iso', 1.4 * GiB]],
    progress: 0.62,
    paused: true,
    downloadRate: 4 * MiB,
    uploadRate: 200 * KiB,
    uploaded: 90 * MiB,
    peers: 18,
    cycles: false,
    age: Duration.hours(2),
  },
  connecting: {
    name: 'Fedora-Workstation-Live-43',
    files: [],
    progress: 0,
    paused: false,
    downloadRate: 0,
    uploadRate: 0,
    uploaded: 0,
    peers: 0,
    cycles: false,
    age: Duration.millis(0),
  },
} as const satisfies Record<FixtureKind, Fixture>

const noLimits = { downloadLimit: null, uploadLimit: null } as const satisfies TorrentLimits

const peerClients = ['qBittorrent 4.6.5.0', 'Transmission 4.0.6.0', 'libtorrent 2.0.10.0', 'Deluge 2.1.1.0'] as const

type Entry = {
  readonly infoHash: InfoHash
  readonly addedAt: number
  readonly name: string
  readonly magnetURI: string
  readonly savePath: string
  paused: boolean
  /** Empty while the torrent is still waiting for metadata, which for fixtures never arrives. */
  files: ReadonlyArray<FileEntry>
  readonly downloadRate: number
  readonly uploadRate: number
  uploaded: number
  readonly peers: number
  readonly cycles: boolean
  limits: TorrentLimits
  /** Whether the selected files were complete at the last tick; drives completion notifications. */
  completed: boolean
}

/** Spreads a byte count over the selected files in order, the way a sequential download fills them. */
const fill = (files: ReadonlyArray<FileEntry>, bytes: number) => {
  let left = bytes
  return files.map((file): FileEntry => {
    if (!file.selected) return file
    const downloaded = Math.min(file.length, left)
    left -= downloaded
    return { ...file, downloaded, progress: file.length > 0 ? clampFraction(downloaded / file.length) : 1 }
  })
}

const statusOf = (entry: Entry, done: boolean): TorrentStatus => {
  if (entry.paused) return done && !entry.cycles ? 'completed' : 'paused'
  if (entry.files.length === 0) return 'metadata'
  return done && !entry.cycles ? 'seeding' : 'downloading'
}

const capped = (rate: number, limit: number | null) => (limit === null ? rate : Math.min(rate, limit))

const downloadRateOf = (entry: Entry, size: number) =>
  capped(entry.cycles ? size / Duration.toSeconds(cycleDuration) : entry.downloadRate, entry.limits.downloadLimit)

const uploadRateOf = (entry: Entry) => capped(entry.uploadRate, entry.limits.uploadLimit)

const summarize = (entry: Entry) => {
  const { size, downloaded, done } = selectionTotals(entry.files)
  const status = statusOf(entry, done)
  const active = status === 'downloading' || status === 'seeding'
  const downloadSpeed = status === 'downloading' ? downloadRateOf(entry, size) : 0
  return {
    infoHash: entry.infoHash,
    name: entry.name,
    size,
    progress: size > 0 ? clampFraction(downloaded / size) : done ? 1 : 0,
    status,
    downloadSpeed,
    uploadSpeed: active ? uploadRateOf(entry) : 0,
    numPeers: active ? entry.peers : 0,
    eta: status === 'downloading' && downloadSpeed > 0 ? (size - downloaded) / downloadSpeed : null,
    downloaded,
    uploaded: entry.uploaded,
    savePath: entry.savePath,
    addedAt: entry.addedAt,
    error: null,
    hasTorrentFile: false,
    ...entry.limits,
  } satisfies TorrentSummary
}

const peersOf = (entry: Entry, summary: TorrentSummary) =>
  Array.from({ length: summary.numPeers }, (_, index): PeerInfo => ({
    id: createHash('sha1')
      .update(`${entry.infoHash}:${String(index)}`)
      .digest('hex'),
    address: `10.0.${String(index >> 8)}.${String((index % 254) + 1)}:6881`,
    client: peerClients[index % peerClients.length] ?? 'Unknown',
    type: index % 3 === 0 ? 'utp' : 'tcpOutgoing',
    progress: ((index * 37) % 100) / 100,
    downloadSpeed: summary.downloadSpeed / summary.numPeers,
    uploadSpeed: summary.uploadSpeed / summary.numPeers,
  }))

const fromFixture = (fixture: Fixture, savePath: string, now: number): Entry => {
  const infoHash = InfoHash.make(createHash('sha1').update(fixture.name).digest('hex'))
  const files = fixture.files.map(([path, length], index): FileEntry => ({
    index,
    name: path.split('/').at(-1) ?? path,
    path,
    length: Math.round(length),
    downloaded: 0,
    progress: 0,
    selected: true,
  }))
  const { size } = selectionTotals(files)
  return {
    infoHash,
    addedAt: now - Duration.toMillis(fixture.age),
    name: fixture.name,
    magnetURI: `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(fixture.name)}`,
    savePath,
    paused: fixture.paused,
    files: fill(files, size * fixture.progress),
    downloadRate: fixture.downloadRate,
    uploadRate: fixture.uploadRate,
    uploaded: fixture.uploaded,
    peers: fixture.peers,
    cycles: fixture.cycles,
    limits: noLimits,
    completed: fixture.progress >= 1,
  }
}

/** In-memory TorrentService over fixture torrents; it never touches the network, the disk or session.json. */
const make = (kinds: ReadonlyArray<FixtureKind>) =>
  Effect.gen(function* () {
    const settings = yield* SettingsService
    const { downloadFolder } = yield* settings.get

    const now = Date.now()
    const entries = new Map<InfoHash, Entry>(
      kinds.map((kind) => {
        const entry = fromFixture(fixtures[kind], downloadFolder, now)
        return [entry.infoHash, entry]
      }),
    )
    const completions = yield* PubSub.unbounded<TorrentCompleted>()

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

    /** Adds a parsed source that stays in the metadata state, since fixtures have no peers to ask. */
    const add = Effect.fn('FixtureTorrentService.add')(function* (source: ParsedSource, savePath: string | undefined) {
      if (savePath !== undefined) yield* checkSavePath(savePath)
      const existing = entries.get(source.infoHash)
      if (existing) return yield* new DuplicateTorrentError({ infoHash: existing.infoHash, name: existing.name })
      const entry: Entry = {
        infoHash: source.infoHash,
        addedAt: Date.now(),
        name: source.name,
        magnetURI: source.magnetURI,
        savePath: savePath ?? (yield* settings.get).downloadFolder,
        paused: false,
        files: [],
        downloadRate: 0,
        uploadRate: 0,
        uploaded: 0,
        peers: 0,
        cycles: false,
        limits: noLimits,
        completed: false,
      }
      entries.set(entry.infoHash, entry)
      return summarize(entry)
    })

    const setPaused = (paused: boolean) => (infoHashes: ReadonlyArray<InfoHash>) =>
      lookupAll(infoHashes).pipe(
        Effect.map((found) => {
          for (const entry of found) entry.paused = paused
        }),
      )

    const remove = Effect.fn('FixtureTorrentService.remove')(function* (
      infoHashes: ReadonlyArray<InfoHash>,
      _deleteFiles: boolean,
    ) {
      for (const entry of yield* lookupAll(infoHashes)) entries.delete(entry.infoHash)
    })

    const selectFiles = Effect.fn('FixtureTorrentService.selectFiles')(function* (
      infoHash: InfoHash,
      selected: ReadonlyArray<number>,
    ) {
      const entry = yield* lookup(infoHash)
      const count = entry.files.length
      if (count === 0)
        return yield* new TorrentEngineError({ message: 'The file list is not known until metadata arrives' })
      if (selected.some((index) => index >= count))
        return yield* new TorrentEngineError({ message: 'File index out of range' })
      const chosen = new Set(selected)
      entry.files = entry.files.map((file) => ({ ...file, selected: chosen.has(file.index) }))
      entry.completed = selectionTotals(entry.files).done
    })

    const setLimits = Effect.fn('FixtureTorrentService.setLimits')(function* (
      infoHashes: ReadonlyArray<InfoHash>,
      limits: Partial<TorrentLimits>,
    ) {
      for (const entry of yield* lookupAll(infoHashes)) entry.limits = { ...entry.limits, ...limits }
    })

    const details = Effect.fn('FixtureTorrentService.details')(function* (infoHash: InfoHash) {
      const entry = yield* lookup(infoHash)
      const summary = summarize(entry)
      const totalSize = entry.files.reduce((sum, file) => sum + file.length, 0)
      return {
        summary,
        magnetURI: entry.magnetURI,
        comment: 'Test fixture',
        pieceCount: Math.ceil(totalSize / pieceLength),
        pieceLength: entry.files.length > 0 ? pieceLength : 0,
        totalSize,
        files: entry.files,
        peers: peersOf(entry, summary),
      } satisfies TorrentDetails
    })

    const contentPath = Effect.fn('FixtureTorrentService.contentPath')(function* (infoHash: InfoHash) {
      const entry = yield* lookup(infoHash)
      return contentPathOf(entry.savePath, entry.files)
    })

    /** Fixtures have no metainfo, so there is never anything to export. */
    const torrentFile = Effect.fn('FixtureTorrentService.torrentFile')(function* (infoHash: InfoHash) {
      const entry = yield* lookup(infoHash)
      return { name: entry.name, bytes: null }
    })

    /** Advances an active fixture by one tick; the cycling one starts over once it has been shown complete. */
    const advance = (entry: Entry) => {
      const { size, downloaded, done } = selectionTotals(entry.files)
      const status = statusOf(entry, done)
      if (status === 'downloading') {
        const next = entry.cycles && done ? 0 : downloaded + downloadRateOf(entry, size) * tickSeconds
        entry.files = fill(entry.files, Math.min(size, next))
      }
      if (status === 'downloading' || status === 'seeding') entry.uploaded += uploadRateOf(entry) * tickSeconds
    }

    const tick = Effect.gen(function* () {
      for (const entry of entries.values()) {
        advance(entry)
        const done = selectionTotals(entry.files).done
        if (done && !entry.completed && !entry.cycles)
          yield* PubSub.publish(completions, { infoHash: entry.infoHash, name: entry.name })
        entry.completed = done
      }
      yield* SubscriptionRef.set(progress, snapshot())
    })

    yield* Stream.tick(tickInterval).pipe(
      Stream.runForEach(() => tick),
      Effect.forkScoped,
    )

    return {
      list: Effect.sync(snapshot),
      addMagnet: (magnet: string, savePath?: string) =>
        parseMagnet(magnet).pipe(Effect.flatMap((source) => add(source, savePath))),
      addFile: (path: string, savePath?: string, _selected?: ReadonlyArray<number>) =>
        parseTorrentFile(path).pipe(Effect.flatMap((source) => add(source, savePath))),
      pause: setPaused(true),
      resume: setPaused(false),
      remove,
      selectFiles,
      setLimits,
      details,
      contentPath,
      torrentFile,
      infoHashes: Effect.sync(() => [...entries.keys()]),
      progress: SubscriptionRef.changes(progress),
      completions: Stream.fromPubSub(completions),
    } satisfies TorrentService['Service']
  })

/** TorrentService over the given fixtures, chosen at startup by the --list flag of the dev script. */
export const FixtureTorrentServiceLive = (kinds: ReadonlyArray<FixtureKind>) =>
  Layer.effect(TorrentService, make(kinds))
