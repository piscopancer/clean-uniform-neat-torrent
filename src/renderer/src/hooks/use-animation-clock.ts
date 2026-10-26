import { useEffect, useState } from 'react'

/** Current time, updated on every animation frame while mounted, for things that move continuously with time. */
export const useAnimationClock = () => {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      setNow(Date.now())
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return now
}
