import { SiGithub } from '@icons-pack/react-simple-icons'
import { homepage } from '../../../../package.json'
import { useTorrents } from '@/store/torrents'
import { Hint } from './hint'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export const StatusBar = () => {
  const count = useTorrents((state) => state.list.length)
  const selected = useTorrents((state) => state.selected.size)
  return (
    <footer className="flex items-center gap-4 px-3 py-0.5 text-xs text-muted-foreground tabular-nums">
      <span>
        {plural(count, 'torrent')}
        {selected > 0 && `, ${selected} selected`}
      </span>
      {/* links open in the system browser, see the window open handler in main */}
      <Hint content="Project home page">
        <a
          href={homepage}
          target="_blank"
          rel="noreferrer"
          aria-label="Project home page"
          className="ml-auto rounded-sm p-0.5 transition-colors hover:text-foreground"
        >
          {/* the icon always renders an svg title, which the browser would show as a native tooltip; an empty one is not shown */}
          <SiGithub title="" aria-hidden className="size-3.5" />
        </a>
      </Hint>
    </footer>
  )
}
