import { FileUpIcon, LinkIcon, SettingsIcon, type LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { openAddMagnet, openSettings, pickTorrentFile } from '@/lib/actions'
import { cn } from '@/lib/utils'
import { Hint } from './hint'
import { Logo } from './logo'

type ToolProps = {
  readonly icon: LucideIcon
  readonly label: string
  readonly shortcut?: string
  readonly variant?: ComponentProps<typeof Button>['variant']
  /** Writes the label next to the icon instead of leaving it to the hint. */
  readonly labelled?: boolean
  readonly onClick: () => void
}

/** Flat grey icon that rises into a raised tile on hover, like the active item of a sidebar. */
const Tool = ({ icon: Icon, label, shortcut, variant = 'ghost', labelled = false, onClick }: ToolProps) => (
  <Hint content={shortcut === undefined ? label : `${label} (${shortcut})`}>
    <Button
      variant={variant}
      size={labelled ? 'default' : 'icon'}
      aria-label={labelled ? undefined : label}
      className={cn(
        'rounded-lg',
        variant === 'ghost' &&
          'border border-transparent text-muted-foreground hover:raised hover:border-border hover:bg-surface hover:text-foreground dark:hover:bg-surface',
      )}
      onClick={onClick}
    >
      <Icon strokeWidth={1.75} />
      {labelled && label}
    </Button>
  </Hint>
)

/** App bar that also serves as the window's title bar: the logo, then the ways to add torrents and the settings; torrent actions live in the right-click menu. */
export const Toolbar = () => (
  <header className="relative flex h-toolbar shrink-0 items-center gap-1 border-b title-bar">
    <div className="flex size-toolbar shrink-0 items-center justify-center self-stretch border-r">
      <Logo />
    </div>
    <div className="ml-auto" />
    <Tool icon={LinkIcon} label="Add magnet link" shortcut="Ctrl+M" onClick={openAddMagnet} />
    <Tool
      icon={FileUpIcon}
      label="Add torrent file"
      shortcut="Ctrl+O"
      variant="highlight"
      labelled
      onClick={() => void pickTorrentFile()}
    />
    <Separator orientation="vertical" className="mx-1 h-5!" />
    <Tool icon={SettingsIcon} label="Settings" shortcut="Ctrl+," variant="outline" onClick={openSettings} />
  </header>
)
