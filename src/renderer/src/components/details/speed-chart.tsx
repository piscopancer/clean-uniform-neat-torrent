import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { speedHistoryMinutes, speedRanges, type SpeedRange as Range } from '@shared/schemas'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useAnimationClock } from '@/hooks/use-animation-clock'
import { useSpeedHistory, type SpeedSample } from '@/hooks/use-speed-history'
import { saveSettings } from '@/lib/actions'
import type { InfoHash } from '@/lib/api'
import { formatClock, formatClockWithSeconds, formatRate } from '@/lib/format'
import { useSpeedRange } from '@/store/settings'
import { segmentedItem, segmentedTrack } from '../segmented'

/**
 * Selectable spans of the chart. Longer spans average their samples into buckets, so every span draws a readable
 * 60 to 120 points rather than up to 3600 raw seconds. Ticks sit on fixed multiples of `tickSeconds`, so the labels
 * slide along with the line instead of being picked anew on every frame.
 */
const ranges = {
  '1m': { minutes: 1, bucketSeconds: 1, tickSeconds: 10, tick: formatClockWithSeconds },
  '10m': { minutes: 10, bucketSeconds: 5, tickSeconds: 120, tick: formatClock },
  '60m': { minutes: speedHistoryMinutes, bucketSeconds: 30, tickSeconds: 600, tick: formatClock },
} as const satisfies Record<
  Range,
  { minutes: number; bucketSeconds: number; tickSeconds: number; tick: (time: number) => string }
>

/** Every multiple of the step inside the span. */
const ticksBetween = (from: number, to: number, stepMs: number) =>
  Array.from(
    { length: Math.floor(to / stepMs) - Math.ceil(from / stepMs) + 1 },
    (_, index) => (Math.ceil(from / stepMs) + index) * stepMs,
  )

const chartConfig = {
  downloadSpeed: { label: 'Download', color: 'var(--highlight)' },
  uploadSpeed: { label: 'Upload', color: 'var(--muted-foreground)' },
} as const satisfies ChartConfig
const series = Object.keys(chartConfig).filter((key): key is keyof typeof chartConfig => key in chartConfig)

/** Averages the samples inside the span into buckets of the range's size, keyed by each bucket's start. */
const bucketize = (samples: ReadonlyArray<SpeedSample>, range: Range, from: number) => {
  const bucketMs = ranges[range].bucketSeconds * 1000
  const buckets = new Map<number, { downloadSpeed: number; uploadSpeed: number; count: number }>()
  for (const sample of samples) {
    if (sample.time <= from) continue
    const time = Math.floor(sample.time / bucketMs) * bucketMs
    const bucket = buckets.get(time) ?? { downloadSpeed: 0, uploadSpeed: 0, count: 0 }
    bucket.downloadSpeed += sample.downloadSpeed
    bucket.uploadSpeed += sample.uploadSpeed
    bucket.count += 1
    buckets.set(time, bucket)
  }
  return [...buckets].map(([time, { downloadSpeed, uploadSpeed, count }]) => ({
    time,
    downloadSpeed: downloadSpeed / count,
    uploadSpeed: uploadSpeed / count,
  }))
}

/** Download and upload speed of one torrent over the chosen span, as two overlaid areas. */
export const SpeedChart = ({ infoHash }: { readonly infoHash: InfoHash }) => {
  const samples = useSpeedHistory(infoHash)
  // the chosen span is a setting, so it survives closing the sheet and restarting the app
  const range = useSpeedRange()
  const { minutes, bucketSeconds, tickSeconds, tick } = ranges[range]
  const spanMs = minutes * 60_000
  // the span slides every frame, trailing the clock by one bucket and one second so the newest point has always
  // arrived before it enters the view; the line moves smoothly instead of jumping once a second
  const end = useAnimationClock() - bucketSeconds * 1000 - 1000
  const from = end - spanMs
  // buckets change only with the samples; one extra bucket on each side keeps the line running past both edges
  const latest = samples.at(-1)?.time ?? 0
  const data = useMemo(
    () => bucketize(samples, range, latest - spanMs - 2 * bucketSeconds * 1000),
    [samples, range, latest, spanMs, bucketSeconds],
  )
  const ticks = ticksBetween(from, end, tickSeconds * 1000)

  return (
    <div className="flex flex-col gap-3 rounded-xl raised-static p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Speed</span>
        <div className={segmentedTrack}>
          {speedRanges.map((name) => (
            <Button
              key={name}
              variant="ghost"
              size="xs"
              className={segmentedItem}
              aria-pressed={name === range}
              onClick={() => void saveSettings({ speedRange: name })}
            >
              {name}
            </Button>
          ))}
        </div>
      </div>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-48 w-full [&_.recharts-cartesian-axis-tick-value]:font-mono"
      >
        {/* the right margin leaves room for half of the last time label, which is centred on the chart's edge */}
        <AreaChart data={data} margin={{ top: 4, right: 28, bottom: 0, left: 0 }}>
          <defs>
            {series.map((key) => (
              <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.5} />
                <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={[from, end]}
            allowDataOverflow
            ticks={ticks}
            interval={0}
            tickFormatter={tick}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tickFormatter={formatRate} tickLine={false} axisLine={false} width={72} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => formatClockWithSeconds(Number(payload[0]?.payload?.time))}
                labelClassName="font-mono"
                valueFormatter={formatRate}
              />
            }
          />
          {series.map((key) => (
            <Area
              key={key}
              dataKey={key}
              type="monotone"
              stroke={`var(--color-${key})`}
              fill={`url(#fill-${key})`}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
