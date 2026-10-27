import { NodeRuntime, NodeServices } from '@effect/platform-node'
import { Effect, Option, Schema } from 'effect'
import { Command, Flag } from 'effect/cli'
import { createServer } from 'electron-vite'
import packageJson from '../package.json' with { type: 'json' }
import { fixtureKinds, ListFlag, listEnv } from '../src/main/fixtures/list-flag.ts'
import { toastEnv, toastFlags } from '../src/shared/toast-flag.ts'

const encodeList = Schema.encodeEffect(ListFlag)

/** Validates the launch flags, then runs the electron-vite dev server in watch mode within this process. */
const dev = Command.make(
  'dev',
  {
    list: Flag.String('list').pipe(
      Flag.withDescription(
        `Replace the real torrents with fixtures: "test" for all ${String(fixtureKinds.length)}, or a count from 1 (${fixtureKinds.join(', ')})`,
      ),
      Flag.withSchema(ListFlag),
      Flag.optional,
    ),
    toast: Flag.Literals('toast', toastFlags).pipe(
      Flag.withDescription('"test" lets the T key show a random toast of the app with made-up data'),
      Flag.optional,
    ),
  },
  Effect.fn(function* ({ list, toast }) {
    // Electron inherits this process's environment, so main reads the choice from here
    if (Option.isSome(list)) process.env[listEnv] = yield* encodeList(list.value)
    else delete process.env[listEnv]
    // read by electron-vite, which exposes it to the renderer
    if (Option.isSome(toast)) process.env[toastEnv] = toast.value
    else delete process.env[toastEnv]
    yield* Effect.promise(() => createServer({ build: { watch: {} } }, {}))
    yield* Effect.never
  }),
).pipe(Command.withDescription('Start Clean Uniform Neat Torrent in development mode'))

dev.pipe(Command.run({ version: packageJson.version }), Effect.provide(NodeServices.layer), NodeRuntime.runMain)
