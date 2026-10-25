import { useEffect, useState } from 'react'
import { api, run, type Output } from '@/lib/api'
import { useSystemAccent } from '@/store/settings'

type Accent = Output<'system.accentColor'>

const luminanceWeights = [0.2126, 0.7152, 0.0722] as const

/** WCAG relative luminance of a #rrggbb colour. */
const luminance = (hex: string) =>
  luminanceWeights.reduce((sum, weight, index) => {
    const channel = Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    return sum + weight * linear
  }, 0)

/** Black or white, whichever contrasts more with the accent; 0.179 is where both contrast ratios are equal. */
const readableOn = (hex: string) => (luminance(hex) > 0.179 ? '#000000' : '#ffffff')

/** Variables the accent overrides; the ring follows it so focus outlines match the highlights. */
const accentVariables = ['--highlight', '--highlight-foreground', '--ring'] as const

/** Follows the OS accent colour and, while the setting is on, paints the highlight variables with it. */
export const useAccent = () => {
  const enabled = useSystemAccent()
  const [accent, setAccent] = useState<Accent>(null)

  useEffect(() => {
    void run('system.accentColor').then((result) => {
      if (result.ok) setAccent(result.value)
    })
    return api.onAccentColor(setAccent)
  }, [])

  useEffect(() => {
    const { style } = document.documentElement
    if (!enabled || accent === null) {
      for (const variable of accentVariables) style.removeProperty(variable)
      return
    }
    const values = {
      '--highlight': accent,
      '--highlight-foreground': readableOn(accent),
      '--ring': accent,
    } as const satisfies Record<(typeof accentVariables)[number], string>
    for (const variable of accentVariables) style.setProperty(variable, values[variable])
  }, [enabled, accent])
}
