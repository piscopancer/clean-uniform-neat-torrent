import { Layer, ManagedRuntime } from 'effect'
import { BridgeLive } from './services/bridge'
import { BroadcasterLive } from './services/broadcaster'
import { SessionStoreLive } from './services/session-store'
import { SettingsServiceLive } from './services/settings-service'
import { TorrentClientLive } from './services/torrent-client'
import { TorrentServiceLive } from './services/torrent-service'
import { UpdateServiceLive } from './services/update-service'

const InfrastructureLive = Layer.mergeAll(TorrentClientLive, SettingsServiceLive, SessionStoreLive, BroadcasterLive)

export const MainLive = BridgeLive.pipe(
  Layer.provideMerge(Layer.mergeAll(TorrentServiceLive, UpdateServiceLive)),
  Layer.provideMerge(InfrastructureLive),
)

/** Every service available to IPC handlers and other main-process effects. */
export type MainServices = Layer.Success<typeof MainLive>

/** Builds the main-process runtime; it must be created after app ready because services read Electron paths. */
export const makeRuntime = () => ManagedRuntime.make(MainLive)
export type MainRuntime = ReturnType<typeof makeRuntime>
