import { useCallback, useEffect, useState } from 'react'
import { api, type InfoHash, type Output } from '@/lib/api'

export type Details = Output<'torrents.details'>

/** Matches main's progress cadence so the panel and the table tick together. */
const pollInterval = 1000

/** Polls details of one torrent while mounted; failures keep the last value instead of toasting every tick. */
export const useDetails = (infoHash: InfoHash) => {
  const [details, setDetails] = useState<Details | null>(null)

  const reload = useCallback(async () => {
    const result = await api.invoke('torrents.details', { infoHash })
    if (result.ok) setDetails(result.value)
  }, [infoHash])

  useEffect(() => {
    setDetails(null)
    void reload()
    const timer = window.setInterval(() => void reload(), pollInterval)
    return () => window.clearInterval(timer)
  }, [reload])

  return [details, setDetails, reload] as const
}
