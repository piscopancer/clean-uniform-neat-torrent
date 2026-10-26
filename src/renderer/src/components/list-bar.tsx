import { SearchIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setQuery, useTorrents } from '@/store/torrents'
import { ViewSwitcher } from './torrent-view'

/** Bar above the list that shapes what it shows: a name filter on the left and the layout switcher on the right. */
export const ListBar = () => {
  const query = useTorrents((state) => state.query)
  return (
    <div className="flex items-center gap-2 border-b p-1.5">
      <div className="relative w-full max-w-xs">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          placeholder="Search torrents"
          aria-label="Search torrents"
          className="h-8 pr-8 pl-8 text-sm [&::-webkit-search-cancel-button]:appearance-none"
          onChange={(event) => setQuery(event.target.value)}
        />
        {query !== '' && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Clear search"
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
            onClick={() => setQuery('')}
          >
            <XIcon />
          </Button>
        )}
      </div>
      <div className="ml-auto" />
      <ViewSwitcher />
    </div>
  )
}
