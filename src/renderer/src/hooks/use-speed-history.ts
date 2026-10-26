import { useEffect, useState } from 'react'
import { speedHistoryMinutes } from '@shared/schemas'
import { api, type InfoHash, type Output } from '@/lib/api'
import { useTorrents } from '@/store/torrents'

export type SpeedSample = Output<'torrents.speedHistory'>[number]

const windowMs = speedHistoryMinutes * 60_000

/** Main's speed history of one torrent, then extended by every progress snapshot while mounted. */
export const useSpeedHistory = (infoHash: InfoHash) => {
  const [samples, setSamples] = useState<ReadonlyArray<SpeedSample>>([])

  useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}
    setSamples([])
    void api.invoke('torrents.speedHistory', { infoHash }).then((result) => {
      if (cancelled || !result.ok) return
      setSamples(result.value)
      // every snapshot replaces the list, so a new list means one more second of history
      unsubscribe = useTorrents.subscribe((state, previous) => {
        const torrent = state.byHash.get(infoHash)
        if (state.list === previous.list || torrent === undefined) return
        const time = Date.now()
        const { downloadSpeed, uploadSpeed } = torrent
        setSamples((current) => [
          ...current.filter((sample) => sample.time > time - windowMs),
          { time, downloadSpeed, uploadSpeed },
        ])
      })
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [infoHash])

  return samples
}
