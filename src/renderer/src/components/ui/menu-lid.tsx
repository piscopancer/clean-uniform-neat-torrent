import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react"

/** Spring the lid glides on between items, quick and barely overshooting. */
const glide = { type: "spring", duration: 0.3, bounce: 0.15 } as const

const fade = { duration: 0.15, ease: "easeOut" } as const

/**
 * How long the lid waits before fading once no item is highlighted. Radix focuses the menu itself between leaving one
 * item and entering the next, so the lid holds on through that gap, or a separator, and glides on instead of blinking.
 */
const hideDelay = 120

/**
 * Glass lid gliding under the highlighted item of a menu, styled by the glass-lid utility. Radix highlights an item by
 * focusing it, on hover as on keyboard moves, and focuses the menu itself once the pointer leaves the items, so focus
 * alone drives the lid. Motion values move it, so hovering re-renders nothing. The menu must be positioned for the lid
 * to line up with its items, and render `lid` before them so they paint over it.
 */
function useMenuLid(onFocus?: React.FocusEventHandler<HTMLDivElement>) {
  const y = useMotionValue(0)
  const height = useMotionValue(0)
  const opacity = useMotionValue(0)
  const lit = React.useRef(false)
  const hideTimer = React.useRef<number | undefined>(undefined)
  const reduceMotion = useReducedMotion() ?? false
  React.useEffect(() => () => window.clearTimeout(hideTimer.current), [])
  const follow = (event: React.FocusEvent<HTMLDivElement>) => {
    onFocus?.(event)
    // focus inside a submenu bubbles here through its portal, but the submenu has a lid of its own
    if (!event.currentTarget.contains(event.target)) return
    const item = event.target.closest<HTMLElement>("[role^=menuitem]")
    window.clearTimeout(hideTimer.current)
    if (item === null) {
      hideTimer.current = window.setTimeout(() => {
        lit.current = false
        animate(opacity, 0, fade)
      }, hideDelay)
      return
    }
    // a hidden lid jumps to the item and only fades in, instead of gliding from wherever it was last
    if (!lit.current || reduceMotion) {
      y.jump(item.offsetTop)
      height.jump(item.offsetHeight)
    } else {
      animate(y, item.offsetTop, glide)
      animate(height, item.offsetHeight, glide)
    }
    lit.current = true
    animate(opacity, 1, fade)
  }
  return {
    onFocus: follow,
    lid: <motion.span aria-hidden className="glass-lid" style={{ y, height, opacity }} />,
  }
}

export { useMenuLid }
