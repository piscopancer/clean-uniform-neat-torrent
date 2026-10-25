import type { CommandArgs, CommandName, CommandOutputEncoded, EventName, EventPayloadEncoded } from '@shared/contract'
import { toastError } from './errors'

/** Typed bridge to main; every call resolves to an IpcResult and never rejects. */
export const api = window.api

/** Payload of a push event as the renderer receives it. */
export type Pushed<K extends EventName> = EventPayloadEncoded<K>
export type Output<K extends CommandName> = CommandOutputEncoded<K>
export type Summary = Pushed<'progress'>['torrents'][number]
export type InfoHash = Summary['infoHash']

/** Invokes a command, toasting its error, and returns the IpcResult for callers that need the value. */
export const run = async <K extends CommandName>(name: K, ...args: CommandArgs<K>) => {
  const result = await api.invoke(name, ...args)
  if (!result.ok) toastError(result.error)
  return result
}
