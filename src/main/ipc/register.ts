import { ipcMain } from 'electron'
import { Cause, Effect, Exit, Result, Schema } from 'effect'
import { commandNames, contract, type CommandName, type CommandOutputEncoded, type IpcResult } from '@shared/contract'
import { InvalidInputError, IpcError, UnexpectedError } from '@shared/errors'
import type { MainRuntime } from '../runtime'
import { handlers } from './handlers'

const encodeError = Schema.encodeUnknownSync(IpcError)

/** Decodes the raw input, runs the handler and encodes the outcome; never rejects. */
const runCommand = <K extends CommandName>(runtime: MainRuntime, name: K, raw: unknown) => {
  const { input, output } = contract[name]
  const program = Schema.decodeUnknownEffect(input)(raw).pipe(
    Effect.mapError((error) => new InvalidInputError({ command: name, message: error.message })),
    Effect.flatMap((decoded) => handlers[name](decoded)),
    Effect.flatMap((value) => Schema.encodeUnknownEffect(output)(value).pipe(Effect.orDie)),
  )
  return runtime.runPromiseExit(program).then((exit) => {
    if (Exit.isSuccess(exit)) {
      // the value was just encoded with this command's output schema
      const value = exit.value as CommandOutputEncoded<K>
      return { ok: true, value } satisfies IpcResult<CommandOutputEncoded<K>>
    }
    const failure = Cause.findError(exit.cause)
    const error = Result.isSuccess(failure)
      ? failure.success
      : new UnexpectedError({ message: Cause.pretty(exit.cause) })
    if (!Result.isSuccess(failure)) console.error(`[ipc] ${name}`, Cause.pretty(exit.cause))
    return { ok: false, error: encodeError(error) } satisfies IpcResult<CommandOutputEncoded<K>>
  })
}

/** Registers every contract command on ipcMain. */
export const registerIpc = (runtime: MainRuntime) => {
  for (const name of commandNames) {
    ipcMain.handle(name, (_event, raw: unknown) => runCommand(runtime, name, raw))
  }
  return () => commandNames.forEach((name) => ipcMain.removeHandler(name))
}
