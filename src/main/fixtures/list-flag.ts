import { Schema } from 'effect'

// imported by scripts/dev.ts under plain Node, so this module must not use path aliases

/** One fixture per state the torrent list can show, in the order --list=N takes them. */
export const fixtureKinds = ['completed', 'seeding', 'stalled', 'cycling', 'paused', 'connecting'] as const
export type FixtureKind = (typeof fixtureKinds)[number]

/** Environment variable through which the dev script hands a validated --list value to the main process. */
export const listEnv = 'TORRENT_FIXTURES'

/** Value of --list: test loads every fixture, a number loads that many from the start of the list. */
export const ListFlag = Schema.Union([
  Schema.Literal('test'),
  Schema.NumberFromString.pipe(
    Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: fixtureKinds.length })),
  ),
])
export type ListFlag = typeof ListFlag.Type

export const fixturesOf = (list: ListFlag) => fixtureKinds.slice(0, list === 'test' ? fixtureKinds.length : list)
