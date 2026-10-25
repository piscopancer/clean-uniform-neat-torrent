import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Effect, Schema } from 'effect'
import { messageOf, PersistenceError, SaveFolderMissingError } from '@shared/errors'

const isMissingFile = (cause: unknown) => cause instanceof Error && 'code' in cause && cause.code === 'ENOENT'

/** Reads and decodes a JSON file, yielding null when the file does not exist yet. */
export const readJsonFile = <S extends Schema.Codec<unknown, unknown>>(file: string, schema: S) =>
  Effect.gen(function* () {
    const text = yield* Effect.tryPromise({
      try: () =>
        readFile(file, 'utf8').catch((cause: unknown) => (isMissingFile(cause) ? null : Promise.reject(cause))),
      catch: (cause) => new PersistenceError({ file, message: messageOf(cause) }),
    })
    if (text === null) return null
    return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(text).pipe(
      Effect.mapError((error) => new PersistenceError({ file, message: error.message })),
    )
  })

/** Encodes a value and writes it as JSON through a temporary file so a crash never leaves a truncated file. */
export const writeJsonFile = <S extends Schema.Codec<unknown, unknown>>(file: string, schema: S, value: S['Type']) =>
  Effect.gen(function* () {
    const text = yield* Schema.encodeEffect(Schema.fromJsonString(schema, { space: 2 }))(value).pipe(
      Effect.mapError((error) => new PersistenceError({ file, message: error.message })),
    )
    const temporary = `${file}.tmp`
    yield* Effect.tryPromise({
      try: async () => {
        await mkdir(dirname(file), { recursive: true })
        await writeFile(temporary, text, 'utf8')
        await rename(temporary, file)
      },
      catch: (cause) => new PersistenceError({ file, message: messageOf(cause) }),
    })
  })

/** Fails with SaveFolderMissingError unless the path is an existing directory. */
export const ensureDirectory = (path: string) =>
  Effect.tryPromise({
    try: () => stat(path),
    catch: () => new SaveFolderMissingError({ path }),
  }).pipe(
    Effect.filterOrFail(
      (stats) => stats.isDirectory(),
      () => new SaveFolderMissingError({ path }),
    ),
    Effect.asVoid,
  )
