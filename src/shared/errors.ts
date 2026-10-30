import { Schema } from 'effect'
import { InfoHash } from './schemas'

export class InvalidMagnetError extends Schema.TaggedError<InvalidMagnetError>()('InvalidMagnetError', {
  magnet: Schema.String,
}) {}

export class InvalidTorrentFileError extends Schema.TaggedError<InvalidTorrentFileError>()('InvalidTorrentFileError', {
  path: Schema.String,
  reason: Schema.String,
}) {}

export class DuplicateTorrentError extends Schema.TaggedError<DuplicateTorrentError>()('DuplicateTorrentError', {
  infoHash: InfoHash,
  name: Schema.String,
}) {}

export class TorrentNotFoundError extends Schema.TaggedError<TorrentNotFoundError>()('TorrentNotFoundError', {
  infoHash: InfoHash,
}) {}

export class SaveFolderMissingError extends Schema.TaggedError<SaveFolderMissingError>()('SaveFolderMissingError', {
  path: Schema.String,
}) {}

export class InvalidSavePathError extends Schema.TaggedError<InvalidSavePathError>()('InvalidSavePathError', {
  path: Schema.String,
  reason: Schema.String,
}) {}

export class TorrentEngineError extends Schema.TaggedError<TorrentEngineError>()('TorrentEngineError', {
  message: Schema.String,
}) {}

export class PersistenceError extends Schema.TaggedError<PersistenceError>()('PersistenceError', {
  file: Schema.String,
  message: Schema.String,
}) {}

export class UpdateError extends Schema.TaggedError<UpdateError>()('UpdateError', {
  message: Schema.String,
}) {}

/** IPC input failed schema validation. */
export class InvalidInputError extends Schema.TaggedError<InvalidInputError>()('InvalidInputError', {
  command: Schema.String,
  message: Schema.String,
}) {}

/** A defect in main that has no typed error; reported instead of throwing across IPC. */
export class UnexpectedError extends Schema.TaggedError<UnexpectedError>()('UnexpectedError', {
  message: Schema.String,
}) {}

export const IpcError = Schema.Union([
  InvalidMagnetError,
  InvalidTorrentFileError,
  DuplicateTorrentError,
  TorrentNotFoundError,
  SaveFolderMissingError,
  InvalidSavePathError,
  TorrentEngineError,
  PersistenceError,
  UpdateError,
  InvalidInputError,
  UnexpectedError,
])
export type IpcError = typeof IpcError.Type
/** Plain-object form of an IpcError as it crosses the IPC boundary. */
export type IpcErrorEncoded = typeof IpcError.Encoded
export type IpcErrorTag = IpcError['_tag']

/** Extracts a readable message from an unknown thrown value. */
export const messageOf = (cause: unknown) =>
  cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : String(cause)
