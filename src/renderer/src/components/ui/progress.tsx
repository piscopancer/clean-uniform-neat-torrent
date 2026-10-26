"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Progress as ProgressPrimitive } from "radix-ui"

/** Id of the shared SVG filter that makes the liquid wobble; rendered once by `LiquidFilter`. */
const liquidFilterId = "liquid-wobble"

/**
 * Slowly changing turbulence that displaces the streaks of every progress liquid, so they ripple like a
 * fluid instead of sliding as rigid stripes. Mounted once per window and referenced by id from each bar; `paused`
 * stops the ripple while the bars are hidden behind a modal.
 */
function LiquidFilter({ paused }: { paused: boolean }) {
  const svg = React.useRef<SVGSVGElement>(null)
  React.useEffect(() => {
    if (paused) svg.current?.pauseAnimations()
    else svg.current?.unpauseAnimations()
  }, [paused])
  return (
    <svg ref={svg} aria-hidden className="pointer-events-none absolute size-0">
      <filter id={liquidFilterId}>
        <feTurbulence type="fractalNoise" baseFrequency="0.06 0.4" numOctaves="2" seed="4">
          <animate
            attributeName="baseFrequency"
            dur="7s"
            values="0.06 0.4;0.09 0.52;0.06 0.4"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" scale="4" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  // random point of the liquid's loop for this bar, as a share of the cycle, kept for the bar's lifetime
  const [phases] = React.useState(() => ({ "--flow-phase": Math.random(), "--bubbles-phase": Math.random() }))
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "glass-tube h-3.5 w-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="glass-liquid"
        // CSS custom properties are not part of React.CSSProperties
        style={{ "--progress": `${value ?? 0}%`, ...phases } as React.CSSProperties}
      >
        <div className="liquid-flow" style={{ filter: `url(#${liquidFilterId})` }} />
        <div className="liquid-bubbles" />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
}

export { LiquidFilter, Progress }
