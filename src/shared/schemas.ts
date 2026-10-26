import { Schema } from 'effect'

/** Lowercase hex SHA-1 info hash that identifies a torrent everywhere in the app. */
export const InfoHash = Schema.String.pipe(Schema.check(Schema.isPattern(/^[0-9a-f]{40}$/)), Schema.brand('InfoHash'))
export type InfoHash = typeof InfoHash.Type

/** Non-negative byte count or rate. */
export const Bytes = Schema.Number.pipe(Schema.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0)))

/** Speed limit in bytes per second, null meaning unlimited. */
export const SpeedLimit = Schema.NullOr(Bytes.pipe(Schema.check(Schema.isInt(), Schema.isGreaterThan(0))))
export type SpeedLimit = typeof SpeedLimit.Type

/** Ratio in the closed interval [0, 1]. */
export const Fraction = Schema.Number.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 1 })))

export const FileIndex = Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))

export const torrentStatuses = ['metadata', 'downloading', 'seeding', 'paused', 'error'] as const
export const TorrentStatus = Schema.Literals(torrentStatuses)
export type TorrentStatus = typeof TorrentStatus.Type

export const TorrentSummary = Schema.Struct({
  infoHash: InfoHash,
  name: Schema.String,
  /** Total size of the files selected for download. */
  size: Bytes,
  /** Progress over the selected files only. */
  progress: Fraction,
  status: TorrentStatus,
  downloadSpeed: Bytes,
  uploadSpeed: Bytes,
  numPeers: Schema.Int,
  /** Remaining seconds, null when unknown or not downloading. */
  eta: Schema.NullOr(Bytes),
  ratio: Bytes,
  downloaded: Bytes,
  uploaded: Bytes,
  savePath: Schema.String,
  addedAt: Schema.Number,
  error: Schema.NullOr(Schema.String),
})
export type TorrentSummary = typeof TorrentSummary.Type

export const FileEntry = Schema.Struct({
  index: FileIndex,
  name: Schema.String,
  path: Schema.String,
  length: Bytes,
  downloaded: Bytes,
  progress: Fraction,
  selected: Schema.Boolean,
})
export type FileEntry = typeof FileEntry.Type

export const peerTypes = ['tcpIncoming', 'tcpOutgoing', 'utp', 'webrtc', 'webSeed'] as const
export const PeerType = Schema.Literals(peerTypes)
export type PeerType = typeof PeerType.Type

export const PeerInfo = Schema.Struct({
  id: Schema.String,
  address: Schema.String,
  client: Schema.String,
  type: PeerType,
  progress: Fraction,
  downloadSpeed: Bytes,
  uploadSpeed: Bytes,
})
export type PeerInfo = typeof PeerInfo.Type

export const TorrentDetails = Schema.Struct({
  summary: TorrentSummary,
  magnetURI: Schema.String,
  comment: Schema.String,
  pieceCount: Schema.Int,
  pieceLength: Bytes,
  totalSize: Bytes,
  files: Schema.Array(FileEntry),
  peers: Schema.Array(PeerInfo),
})
export type TorrentDetails = typeof TorrentDetails.Type

/** A torrent's transfer rates at one moment; main takes one per progress tick. */
export const SpeedSample = Schema.Struct({ time: Schema.Number, downloadSpeed: Bytes, uploadSpeed: Bytes })
export type SpeedSample = typeof SpeedSample.Type

/** How far back main keeps each torrent's speed samples. */
export const speedHistoryMinutes = 60

export const ProgressSnapshot = Schema.Struct({
  torrents: Schema.Array(TorrentSummary),
  downloadSpeed: Bytes,
  uploadSpeed: Bytes,
})
export type ProgressSnapshot = typeof ProgressSnapshot.Type

export const themes = ['dark', 'light', 'system'] as const
export const Theme = Schema.Literals(themes)
export type Theme = typeof Theme.Type

/** How the torrent list is laid out: a sortable table or a grid of cards. */
export const torrentViews = ['table', 'grid'] as const
export const TorrentView = Schema.Literals(torrentViews)
export type TorrentView = typeof TorrentView.Type

/** Span of the speed chart in the details sheet. */
export const speedRanges = ['1m', '10m', '60m'] as const
export const SpeedRange = Schema.Literals(speedRanges)
export type SpeedRange = typeof SpeedRange.Type

/** OS accent colour as lowercase #rrggbb, null where the OS has none. */
export const AccentColor = Schema.NullOr(Schema.String.pipe(Schema.check(Schema.isPattern(/^#[0-9a-f]{6}$/))))
export type AccentColor = typeof AccentColor.Type

/** Bounds for the window zoom factor, where 1 is 100%. */
export const zoomRange = { minimum: 0.5, maximum: 2 } as const
export const ZoomFactor = Schema.Number.pipe(Schema.check(Schema.isBetween(zoomRange)))

export const Settings = Schema.Struct({
  downloadFolder: Schema.String,
  downloadLimit: SpeedLimit,
  uploadLimit: SpeedLimit,
  startMinimized: Schema.Boolean,
  launchOnStartup: Schema.Boolean,
  theme: Theme,
  zoomFactor: ZoomFactor,
  torrentView: TorrentView,
  speedRange: SpeedRange,
  useSystemAccent: Schema.Boolean,
  /** Animated liquid shaders in the progress bars; off by default as they cost GPU time. */
  enhancedVisuals: Schema.Boolean,
})
export type Settings = typeof Settings.Type

export const SettingsPatch = Schema.Struct({
  downloadFolder: Schema.optionalKey(Schema.NonEmptyString),
  downloadLimit: Schema.optionalKey(SpeedLimit),
  uploadLimit: Schema.optionalKey(SpeedLimit),
  startMinimized: Schema.optionalKey(Schema.Boolean),
  launchOnStartup: Schema.optionalKey(Schema.Boolean),
  theme: Schema.optionalKey(Theme),
  zoomFactor: Schema.optionalKey(ZoomFactor),
  torrentView: Schema.optionalKey(TorrentView),
  speedRange: Schema.optionalKey(SpeedRange),
  useSystemAccent: Schema.optionalKey(Schema.Boolean),
  enhancedVisuals: Schema.optionalKey(Schema.Boolean),
})
export type SettingsPatch = typeof SettingsPatch.Type

export const UpdateStatus = Schema.TaggedUnion({
  Idle: {},
  Checking: {},
  Available: { version: Schema.String },
  NotAvailable: {},
  Downloading: { percent: Schema.Number },
  Downloaded: { version: Schema.String },
  Failed: { message: Schema.String },
  Unsupported: {},
})
export type UpdateStatus = typeof UpdateStatus.Type

/** Torrent completion pushed to the renderer for in-app feedback. */
export const TorrentCompleted = Schema.Struct({ infoHash: InfoHash, name: Schema.String })
export type TorrentCompleted = typeof TorrentCompleted.Type
