const byteUnits = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const
const decimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const etaUnits = [
  ['d', 86_400],
  ['h', 3_600],
  ['m', 60],
  ['s', 1],
] as const

/** Index into `byteUnits` of the largest unit that keeps the value at 1 or above. */
const byteExponent = (bytes: number) =>
  bytes > 0 ? Math.min(byteUnits.length - 1, Math.floor(Math.log2(bytes) / 10)) : 0

/** Binary-prefixed size such as "1.5 GiB". */
export const formatBytes = (bytes: number) => {
  const exponent = byteExponent(bytes)
  return `${decimal.format(bytes / 1024 ** exponent)} ${byteUnits[exponent]}`
}

/** Exponent of MiB, from which a rate keeps its tenths; below it "404 KiB/s" reads better than "404.4 KiB/s". */
const preciseRateExponent = byteUnits.indexOf('MiB')

/** Transfer rate such as "404 KiB/s" or "4.4 MiB/s", always shown, for totals like the status bar. */
export const formatRate = (bytesPerSecond: number) => {
  const exponent = byteExponent(bytesPerSecond)
  const format = exponent < preciseRateExponent ? whole : decimal
  return `${format.format(bytesPerSecond / 1024 ** exponent)} ${byteUnits[exponent]}/s`
}

/** Transfer rate, blank when idle so busy rows stand out. */
export const formatSpeed = (bytesPerSecond: number) => (bytesPerSecond > 0 ? formatRate(bytesPerSecond) : '')

/** Percentage rounded down, so 99.96% never reads as a finished 100.0%. */
export const formatPercent = (fraction: number) => percent.format(Math.floor(fraction * 1000) / 1000)

/** Remaining time as its two largest non-zero units, such as "2h 5m"; blank when unknown. */
export const formatEta = (seconds: number | null) => {
  if (seconds === null || !Number.isFinite(seconds)) return ''
  let rest = Math.round(seconds)
  const parts = etaUnits.flatMap(([unit, size]) => {
    const value = Math.floor(rest / size)
    rest -= value * size
    return value > 0 ? [`${value}${unit}`] : []
  })
  return parts.length > 0 ? parts.slice(0, 2).join(' ') : '0s'
}

const clock = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })
const clockWithSeconds = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' })

/** Time of day such as "15:42". */
export const formatClock = (timestamp: number) => clock.format(timestamp)

/** Time of day with seconds such as "15:42:07". */
export const formatClockWithSeconds = (timestamp: number) => clockWithSeconds.format(timestamp)

export const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Last segment of a Windows or POSIX path. */
export const baseName = (path: string) => path.split(/[\\/]/).at(-1) ?? path
