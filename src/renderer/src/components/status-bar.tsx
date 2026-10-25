import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'
import { formatRate } from '@/lib/format'
import { useTorrents } from '@/store/torrents'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export const StatusBar = () => {
  const downloadSpeed = useTorrents((state) => state.downloadSpeed)
  const uploadSpeed = useTorrents((state) => state.uploadSpeed)
  const count = useTorrents((state) => state.list.length)
  const selected = useTorrents((state) => state.selected.size)
  return (
    <footer className="flex items-center gap-4 border-t px-3 py-1 text-xs text-muted-foreground tabular-nums">
      <span>
        {plural(count, 'torrent')}
        {selected > 0 && `, ${selected} selected`}
      </span>
      <span className="ml-auto inline-flex items-center gap-1">
        <ArrowDownIcon className="size-3" /> {formatRate(downloadSpeed)}
      </span>
      <span className="inline-flex items-center gap-1">
        <ArrowUpIcon className="size-3" /> {formatRate(uploadSpeed)}
      </span>
    </footer>
  )
}
