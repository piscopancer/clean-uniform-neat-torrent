import { GaugeIcon } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import type { TorrentLimits } from '@shared/schemas'
import { ContextMenuLabel } from '@/components/ui/context-menu'
import { setLimits } from '@/lib/actions'
import { digitsToLimit, limitToText } from '@/lib/format'
import { useSettings } from '@/store/settings'
import { selectedHashes, useTorrents } from '@/store/torrents'
import { limitPatches, PillField, PillInput, SpeedPill } from './speed-pill'

/** Field text of the selection's shared limit, null when the selected torrents differ. */
const selectionText = (key: keyof TorrentLimits) => {
  const { byHash } = useTorrents.getState()
  const limits = new Set(selectedHashes().map((infoHash) => byHash.get(infoHash)?.[key] ?? null))
  const [only, ...rest] = limits
  return only !== undefined && rest.length === 0 ? limitToText(only) : null
}

/** The global limit of a direction in KiB/s, which a torrent without one of its own runs under; empty when there is none. */
const useGlobalLimitText = (key: keyof TorrentLimits) =>
  useSettings((state) => limitToText(state.settings?.[key] ?? null))

/** Keeps typed keys from the menu's type-ahead search; the arrows still move between items, as Radix handles them on the field itself, and Escape still closes. */
const keepKeys = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== 'Escape') event.stopPropagation()
}

const LimitField = ({ limitKey }: { limitKey: keyof TorrentLimits }) => {
  const globalText = useGlobalLimitText(limitKey)
  // read once as the menu opens; the field then owns its text so a refresh never fights the typing
  const [text, setText] = useState(() => selectionText(limitKey))
  const change = (digits: string) => {
    setText(digits)
    void setLimits({ infoHashes: selectedHashes(), ...limitPatches[limitKey](digitsToLimit(digits)) })
  }
  return (
    <PillField limitKey={limitKey}>
      {/* a menu item, so the arrow keys reach it; textbox sends the menu's lid on to the whole section */}
      <ContextMenuPrimitive.Item
        asChild
        role="textbox"
        // the menu stays open on a click or Enter, and keeps the field focused once the pointer leaves it
        onSelect={(event) => event.preventDefault()}
        onPointerLeave={(event) => event.preventDefault()}
      >
        <PillInput
          limitKey={limitKey}
          value={text}
          emptyText={globalText === '' ? undefined : globalText}
          onDigits={change}
          onKeyDown={keepKeys}
        />
      </ContextMenuPrimitive.Item>
    </PillField>
  )
}

/** Speed limits of the selected torrents, applied as they are typed; an empty field shows the global limit it falls back to, and 0 stops that direction. */
export const LimitSection = () => (
  // heading and fields take the lid as one item while a field has focus, the pill letting the glass show through
  <div data-menu-lid>
    <ContextMenuLabel className="flex items-center gap-2 font-normal">
      <GaugeIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      {/* plain spans take the metal text, which the label's own slot attribute keeps off it; the outer one keeps the space between them out of the flex gap */}
      <span>
        <span>Speed limit</span> <span className="text-muted-foreground">KiB/s</span>
      </span>
    </ContextMenuLabel>
    <div className="flex pr-2 pb-1 pl-8 text-xs text-muted-foreground">
      <SpeedPill
        fill
        className="rounded-[5px] has-focus:bg-transparent"
        down={<LimitField limitKey="downloadLimit" />}
        up={<LimitField limitKey="uploadLimit" />}
      />
    </div>
  </div>
)
