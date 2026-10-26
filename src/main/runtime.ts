import { Config, Effect, Layer, ManagedRuntime, Option } from 'effect'
import { fixturesOf, ListFlag, listEnv } from './fixtures/list-flag'
import { BridgeLive } from './services/bridge'
import { BroadcasterLive } from './services/broadcaster'
import { FixtureTorrentServiceLive } from './services/fixture-torrent-service'
import { SessionStoreLive } from './services/session-store'
import { SettingsServiceLive } from './services/settings-service'
import { SpeedHistoryLive } from './services/speed-history'
import { TorrentServiceLive } from './services/torrent-service'
import { UpdateServiceLive } from './services/update-service'

const InfrastructureLive = Layer.mergeAll(SettingsServiceLive, SessionStoreLive, BroadcasterLive)

/** Fixture torrents when the dev script was started with --list, the webtorrent engine otherwise; builds ignore the flag. */
const TorrentServiceSelected = import.meta.env.DEV
  ? Layer.unwrap(
      Effect.gen(function* () {
        const list = yield* Config.schema(ListFlag, listEnv).pipe(Config.option)
        return Option.match(list, {
          onNone: () => TorrentServiceLive,
          onSome: (value) => FixtureTorrentServiceLive(fixturesOf(value)),
        })
      }),
    )
  : TorrentServiceLive

export const MainLive = Layer.mergeAll(BridgeLive, SpeedHistoryLive).pipe(
  Layer.provideMerge(Layer.mergeAll(TorrentServiceSelected, UpdateServiceLive)),
  Layer.provideMerge(InfrastructureLive),
)

/** Every service available to IPC handlers and other main-process effects. */
export type MainServices = Layer.Success<typeof MainLive>

/** Builds the main-process runtime; it must be created after app ready because services read Electron paths. */
export const makeRuntime = () => ManagedRuntime.make(MainLive)
export type MainRuntime = ReturnType<typeof makeRuntime>
