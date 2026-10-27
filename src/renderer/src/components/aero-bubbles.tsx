import type { CSSProperties } from 'react'
import { useExtraVisuals } from '@/store/settings'

/**
 * Where each bubble sits, its diameter in rem and how strongly it shows: one large bubble rising out of the bottom right
 * corner and a few small ones scattered over the rest, each at its own opacity so they read as near and far.
 */
const bubbles = [
  { size: 44, right: '-12rem', bottom: '-20rem', opacity: 0.9 },
  { size: 11, left: '4%', top: '22%', opacity: 0.55 },
  { size: 5, left: '34%', top: '10%', opacity: 0.4 },
  { size: 14, left: '20%', bottom: '6%', opacity: 0.45 },
  { size: 7, right: '34%', top: '34%', opacity: 0.3 },
  { size: 4, right: '10%', top: '12%', opacity: 0.5 },
  { size: 3, left: '52%', bottom: '28%', opacity: 0.35 },
] as const satisfies ReadonlyArray<CSSProperties & { readonly size: number }>

const largest = Math.max(...bubbles.map((bubble) => bubble.size))

type BubbleStyle = CSSProperties & { readonly '--bubble-depth': number }

/**
 * Bigger bubbles read as nearer and shift further with the pointer; the square root keeps small ones from standing
 * still.
 */
const bubbleStyles = bubbles.map(({ size, ...style }): BubbleStyle => ({
  ...style,
  width: `${size}rem`,
  '--bubble-depth': Math.sqrt(size / largest),
}))

/**
 * Tracks the pointer over the window as `--pointer-x` and `--pointer-y` on the field, each from -1 at the left or top
 * edge to 1 at the right or bottom, which the bubbles turn into their shift. Module level, so React attaches it once.
 */
const followPointer = (field: HTMLDivElement) => {
  const onMove = ({ clientX, clientY }: PointerEvent) => {
    field.style.setProperty('--pointer-x', String((clientX / window.innerWidth) * 2 - 1))
    field.style.setProperty('--pointer-y', String((clientY / window.innerHeight) * 2 - 1))
  }
  window.addEventListener('pointermove', onMove)
  return () => window.removeEventListener('pointermove', onMove)
}

/**
 * Grey bubbles in the manner of Windows Aero behind the torrent list, drawn only with extra visuals. They stay put
 * while the list scrolls but drift slightly after the pointer, and the parent must isolate a stacking context so
 * they sit above the panel but under the list.
 */
export const AeroBubbles = () =>
  useExtraVisuals() && (
    // dimmed in the dark theme, where their white reflections would glare against the dark panel
    <div
      ref={followPointer}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden dark:opacity-5"
    >
      {bubbleStyles.map((style, index) => (
        <span key={index} className="aero-bubble" style={style} />
      ))}
    </div>
  )
