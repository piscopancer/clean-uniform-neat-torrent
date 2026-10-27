import { Schema } from 'effect'
import { IpcError, type IpcErrorEncoded } from './errors'
import {
  AccentColor,
  FileIndex,
  InfoHash,
  ProgressSnapshot,
  Settings,
  SettingsPatch,
  SpeedSample,
  TorrentCompleted,
  TorrentDetails,
  TorrentPreview,
  TorrentSummary,
  UpdateStatus,
} from './schemas'

const InfoHashes = Schema.Struct({ infoHashes: Schema.Array(InfoHash) })
const OptionalSavePath = Schema.optionalKey(Schema.NonEmptyString)

/** Every renderer-to-main command with its input and output schemas; all IPC types derive from this object. */
export const contract = {
  'torrents.list': { input: Schema.Void, output: ProgressSnapshot },
  'torrents.addMagnet': {
    input: Schema.Struct({ magnet: Schema.String, savePath: OptionalSavePath }),
    output: TorrentSummary,
  },
  'torrents.addFile': {
    input: Schema.Struct({
      path: Schema.NonEmptyString,
      savePath: OptionalSavePath,
      /** File indices to download; every file when omitted. */
      selected: Schema.optionalKey(Schema.Array(FileIndex)),
    }),
    output: TorrentSummary,
  },
  'torrents.inspectFile': { input: Schema.Struct({ path: Schema.NonEmptyString }), output: TorrentPreview },
  'torrents.pause': { input: InfoHashes, output: Schema.Void },
  'torrents.resume': { input: InfoHashes, output: Schema.Void },
  'torrents.remove': {
    input: Schema.Struct({ infoHashes: Schema.Array(InfoHash), deleteFiles: Schema.Boolean }),
    output: Schema.Void,
  },
  'torrents.details': { input: Schema.Struct({ infoHash: InfoHash }), output: TorrentDetails },
  'torrents.selectFiles': {
    input: Schema.Struct({ infoHash: InfoHash, selected: Schema.Array(FileIndex) }),
    output: Schema.Void,
  },
  'torrents.speedHistory': {
    input: Schema.Struct({ infoHash: InfoHash }),
    output: Schema.Array(SpeedSample),
  },
  'torrents.openFolder': { input: Schema.Struct({ infoHash: InfoHash }), output: Schema.Void },
  /** Resolves to whether the file was written, false when the save dialog was cancelled. */
  'torrents.exportFile': { input: Schema.Struct({ infoHash: InfoHash }), output: Schema.Boolean },
  'dialog.openTorrentFile': { input: Schema.Void, output: Schema.NullOr(Schema.String) },
  'dialog.pickFolder': {
    input: Schema.Struct({ defaultPath: Schema.optionalKey(Schema.String) }),
    output: Schema.NullOr(Schema.String),
  },
  'settings.get': { input: Schema.Void, output: Settings },
  'settings.update': { input: SettingsPatch, output: Settings },
  'app.version': { input: Schema.Void, output: Schema.String },
  'updates.status': { input: Schema.Void, output: UpdateStatus },
  'updates.check': { input: Schema.Void, output: UpdateStatus },
  'updates.install': { input: Schema.Void, output: Schema.Void },
  'system.accentColor': { input: Schema.Void, output: AccentColor },
} as const satisfies Record<string, { readonly input: Schema.Top; readonly output: Schema.Top }>

/** Every main-to-renderer push event with its payload schema. */
export const events = {
  progress: ProgressSnapshot,
  updateStatus: UpdateStatus,
  torrentCompleted: TorrentCompleted,
  backgroundError: IpcError,
  accentColor: AccentColor,
} as const satisfies Record<string, Schema.Top>

export type Contract = typeof contract
export type CommandName = keyof Contract
export type CommandInput<K extends CommandName> = Contract[K]['input']['Type']
export type CommandOutput<K extends CommandName> = Contract[K]['output']['Type']
/** Input as the renderer sends it, before main decodes it. */
export type CommandInputEncoded<K extends CommandName> = Contract[K]['input']['Encoded']
/** Output as the renderer receives it, after main encodes it. */
export type CommandOutputEncoded<K extends CommandName> = Contract[K]['output']['Encoded']

export type Events = typeof events
export type EventName = keyof Events
export type EventPayload<K extends EventName> = Events[K]['Type']
export type EventPayloadEncoded<K extends EventName> = Events[K]['Encoded']

/** Serializable outcome of a command; errors never throw across IPC. */
export type IpcResult<A> =
  { readonly ok: true; readonly value: A } | { readonly ok: false; readonly error: IpcErrorEncoded }

/** Arguments of a command call, omitting the input entirely for commands that take none. */
export type CommandArgs<K extends CommandName> = [CommandInputEncoded<K>] extends [void] ? [] : [CommandInputEncoded<K>]

export const commandNames = Object.keys(contract).filter((name): name is CommandName => name in contract)
