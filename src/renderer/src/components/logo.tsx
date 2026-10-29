import { animate, motion, useMotionValue, useTransform, type ValueAnimationTransition } from 'motion/react'
import { useRef, type PointerEvent } from 'react'

type Point = { readonly x: number; readonly y: number }

/** Furthest the logo can be pulled from its place, in CSS pixels, which it only approaches the harder it is pulled. */
const maxStretch = 50
/** Rubber band: the first pixels of a pull move the logo almost one to one, every later pixel moves it less. */
const stretch = (distance: number) => maxStretch * (1 - 1 / (distance / maxStretch + 1))
/** Opacity left at the full stretch; the logo fades linearly towards it as it moves away. */
const farthestOpacity = 0.15
/** Snap back like a released bowstring, overshooting its place a little before it settles. */
const release: ValueAnimationTransition<number> = { type: 'spring', stiffness: 500, damping: 14 }

/** The μ mark of the app icon: a grey disc with the letter cut out, set into a raised pale disc whose surface shows through the cut. */
export const Logo = () => {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const start = useRef<Point | null>(null)
  const opacity = useTransform(
    [x, y],
    ([dx = 0, dy = 0]: ReadonlyArray<number>) => 1 - ((1 - farthestOpacity) * Math.hypot(dx, dy)) / maxStretch,
  )

  const pull = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return
    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y
    const distance = Math.hypot(dx, dy)
    const ratio = distance === 0 ? 0 : stretch(distance) / distance
    x.set(dx * ratio)
    y.set(dy * ratio)
  }

  const letGo = () => {
    start.current = null
    void animate(x, 0, release)
    void animate(y, 0, release)
  }

  return (
    <motion.div
      role="img"
      aria-label="Clean Uniform Neat Torrent"
      style={{ x, y, opacity }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        x.stop()
        y.stop()
        start.current = { x: event.clientX - x.get(), y: event.clientY - y.get() }
      }}
      onPointerMove={pull}
      onPointerUp={letGo}
      onPointerCancel={letGo}
      className="group relative z-10 size-10 shrink-0 rounded-full border bg-muted bg-(image:--raised-gradient) p-1 shadow-raised transition-[scale] duration-500 ease-out-quint [-webkit-app-region:no-drag] hover:scale-115 active:scale-105 active:duration-150 motion-reduce:transition-none"
    >
      {/*
        the shadow under the grey disc falls into the cut as well, so the letter reads as sunk below the disc like on the
        icon; on hover the pale disc swells while the mark shrinks into it, a press pushes both down quickly, and the
        logo leaves the window drag region, which would otherwise swallow the hover; only scale is transitioned in CSS,
        so the translate that the pull writes is not delayed; a glass dome covers it all and grows with the pale disc
      */}
      <svg
        viewBox="0 0 19.264 19.264"
        className="size-full fill-muted-foreground drop-shadow-[0_1px_1px_oklch(0_0_0/35%)] transition-transform duration-500 ease-out-quint group-hover:scale-80 group-active:scale-70 group-active:duration-150 motion-reduce:transition-none"
      >
        <path d="M19.264,9.638c0-5.319-4.313-9.631-9.632-9.631C4.312,0.007,0,4.32,0,9.638c0,4.1,2.567,7.593,6.177,8.982l-1.818-8.45L3.845,7.782l-0.91-4.224L6.46,2.799l1.303,6.059c0.352,1.636,1.094,2.514,2.316,2.25c0.967-0.208,1.377-0.995,1.487-1.597c0.049-0.228,0.013-0.51-0.047-0.786L10.076,2.02L13.6,1.263l1.646,7.651c0.662,3.077,2.454,3.548,2.454,3.548s-2.419,0.521-3.433,0.738c-1.012,0.219-1.694-1.591-1.694-1.591l-0.07,0.015c-0.288,0.785-0.613,2.06-3.127,2.602c-0.184,0.039-0.364,0.064-0.542,0.083l1.064,4.948C15.092,19.116,19.264,14.867,19.264,9.638z" />
      </svg>
      <span aria-hidden className="glass-dome" />
    </motion.div>
  )
}
