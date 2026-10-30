/** The parts of speed-limiter, which ships no typings, that per-torrent limits drive; webtorrent throttles every peer with it. */
declare module 'speed-limiter' {
  /** Token bucket of the limiter package; a bucket with a parent also draws every token from the parent. */
  type TokenBucket = { parentBucket: TokenBucket | null }

  export class ThrottleGroup {
    constructor(options?: { readonly rate?: number; readonly chunksize?: number; readonly enabled?: boolean })
    readonly bucket: TokenBucket
    getEnabled(): boolean
    getRate(): number
    /** A rate of 0 holds every chunk until the rate rises again. */
    setRate(rate: number, chunksize?: number): void
    _addThrottle(throttle: Throttle): void
    _removeThrottle(throttle: Throttle): void
  }

  /** Stream that passes chunks on as fast as the tokens of its group allow; the group is read anew for every chunk. */
  export class Throttle {
    _group: ThrottleGroup
    setEnabled(enabled: boolean): void
  }
}
