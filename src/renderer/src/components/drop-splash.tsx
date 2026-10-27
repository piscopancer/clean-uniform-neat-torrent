import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/** Points of the loop the dots start at, half a loop apart, so a new dot swells while the previous one fades. */
const pulsePhases = [0, 0.5] as const

type DropSplashProps = {
  readonly className?: string
  readonly 'aria-label'?: string
}

/**
 * Loader drawn as two small coloured dots taking turns to swell out and fade away like a drop on water. It takes
 * the place of a spinner, sized like an icon and painted in the highlight unless a class says otherwise.
 * The splash spreads past the icon box on purpose, so it reads bigger than the dot it starts from.
 */
export const DropSplash = ({ className, 'aria-label': label }: DropSplashProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    role={label === undefined ? undefined : 'img'}
    aria-label={label}
    aria-hidden={label === undefined}
    className={cn('size-4 shrink-0 overflow-visible text-highlight', className)}
  >
    {pulsePhases.map((phase) => (
      <circle
        key={phase}
        className="drop-pulse"
        style={{ '--pulse-phase': phase } as CSSProperties}
        cx="12"
        cy="12"
        r="18"
      />
    ))}
  </svg>
)
