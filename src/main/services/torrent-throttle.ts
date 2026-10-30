import { Throttle, ThrottleGroup } from 'speed-limiter'
import type WebTorrent from 'webtorrent'
import type { Torrent } from 'webtorrent'
import type { TorrentLimits } from '@shared/schemas'

/** Key of webtorrent's global throttle group, under its throttleGroups, behind each per-torrent limit. */
const globalGroupKeys = {
  downloadLimit: 'down',
  uploadLimit: 'up',
} as const satisfies Record<keyof TorrentLimits, string>

type LimitKey = keyof typeof globalGroupKeys

const limitKeys = Object.keys(globalGroupKeys).filter((key): key is LimitKey => key in globalGroupKeys)

/** The two throttles webtorrent puts in a peer's connection, one per direction. */
type PeerThrottles = Record<LimitKey, Throttle>

type Limited = {
  limits: TorrentLimits
  /** Groups of this torrent alone, which draw their tokens from the global groups too while those are enabled. */
  readonly groups: Record<LimitKey, ThrottleGroup>
  readonly peers: Set<PeerThrottles>
}

/** Reads a property of a library object whose internals have no typings, without asserting what it holds. */
const internal = (value: unknown, ...keys: ReadonlyArray<string>) =>
  keys.reduce<unknown>(
    (current, key) =>
      typeof current === 'object' && current !== null && key in current ? Reflect.get(current, key) : undefined,
    value,
  )

/** Finds the throttles of a wire, whose streamx pipeline webtorrent builds as conn → down → counter → wire → up → counter → conn. */
const peerThrottlesOf = (wire: unknown) => {
  const upload = internal(wire, '_readableState', 'pipeTo')
  const counter = internal(wire, '_writableState', 'pipeline', 'from')
  const download = internal(counter, '_writableState', 'pipeline', 'from')
  return download instanceof Throttle && upload instanceof Throttle
    ? ({ downloadLimit: download, uploadLimit: upload } satisfies PeerThrottles)
    : null
}

/** The global group that throttleDownload or throttleUpload drives, null if webtorrent's internals have changed. */
const globalGroupOf = (client: WebTorrent, key: LimitKey) => {
  const group = internal(client, 'throttleGroups', globalGroupKeys[key])
  return group instanceof ThrottleGroup ? group : null
}

/** Moves a throttle to another group; disabling it first releases a chunk still waiting for the old group's tokens. */
const moveThrottle = (throttle: Throttle, group: ThrottleGroup) => {
  if (throttle._group === group) return
  throttle._group._removeThrottle(throttle)
  throttle._group = group
  group._addThrottle(throttle)
  throttle.setEnabled(false)
  throttle.setEnabled(group.getEnabled())
}

/** Per-torrent speed limits layered under webtorrent's global ones, which webtorrent itself has no notion of. */
export const makeTorrentThrottles = (client: WebTorrent) => {
  const limited = new Map<Torrent, Limited>()

  /** Points the torrent's peers at its own group when it has a limit, and back at the global group when it has none. */
  const sync = (state: Limited) => {
    for (const key of limitKeys) {
      const global = globalGroupOf(client, key)
      if (global === null) continue
      const own = state.groups[key]
      const limit = state.limits[key]
      if (limit !== null) {
        own.bucket.parentBucket = global.getEnabled() ? global.bucket : null
        // a chunk larger than the parent's bucket would fail the stream, so chunks follow the stricter rate
        const ceiling = global.getEnabled() ? Math.min(limit, global.getRate()) : limit
        own.setRate(limit, Math.max(1, Math.floor(ceiling / 10)))
      }
      const target = limit === null ? global : own
      for (const peer of state.peers) moveThrottle(peer[key], target)
    }
  }

  return {
    /** Starts applying the limits to every peer the torrent connects to from now on. */
    attach: (torrent: Torrent, limits: TorrentLimits) => {
      const state: Limited = {
        limits,
        groups: { downloadLimit: new ThrottleGroup({ rate: 0 }), uploadLimit: new ThrottleGroup({ rate: 0 }) },
        peers: new Set(),
      }
      limited.set(torrent, state)
      torrent.on('wire', (wire) => {
        const peer = peerThrottlesOf(wire)
        if (peer === null) return
        state.peers.add(peer)
        wire.once('close', () => state.peers.delete(peer))
        sync(state)
      })
      torrent.once('close', () => limited.delete(torrent))
    },
    set: (torrent: Torrent, limits: TorrentLimits) => {
      const state = limited.get(torrent)
      if (!state) return
      state.limits = limits
      sync(state)
    },
    /** Re-links every torrent to the global groups after the global limits change. */
    refresh: () => limited.forEach(sync),
  } as const
}
