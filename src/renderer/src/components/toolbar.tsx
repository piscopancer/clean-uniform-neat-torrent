import {
  FileUpIcon,
  FolderOpenIcon,
  LinkIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  Trash2Icon,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { confirmRemove, openFolder, openSettings, pause, pickTorrentFiles, resume } from '@/lib/actions'
import type { Summary } from '@/lib/api'
import { openDialog } from '@/store/dialogs'
import { selectedHashes, useSelectionSome } from '@/store/torrents'
import { Hint } from './hint'

type ToolProps = {
  readonly icon: LucideIcon
  readonly label: string
  readonly shortcut?: string
  readonly disabled?: boolean
  readonly onClick: () => void
}

const Tool = ({ icon: Icon, label, shortcut, disabled = false, onClick }: ToolProps) => (
  <Hint content={shortcut === undefined ? label : `${label} (${shortcut})`}>
    <Button variant="ghost" size="icon-sm" aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon />
    </Button>
  </Hint>
)

const any = () => true
const canPause = (torrent: Summary) => torrent.status !== 'paused' && torrent.status !== 'error'
const canResume = (torrent: Summary) => torrent.status === 'paused' || torrent.status === 'error'

export const Toolbar = () => {
  const hasSelection = useSelectionSome(any)
  const pausable = useSelectionSome(canPause)
  const resumable = useSelectionSome(canResume)
  return (
    <header className="flex items-center gap-1 border-b px-2 py-1">
      <Tool
        icon={LinkIcon}
        label="Add magnet link"
        shortcut="Ctrl+M"
        onClick={() => openDialog({ kind: 'addMagnet', magnet: '' })}
      />
      <Tool icon={FileUpIcon} label="Add torrent file" shortcut="Ctrl+O" onClick={() => void pickTorrentFiles()} />
      <Separator orientation="vertical" className="mx-1 h-5!" />
      <Tool icon={PlayIcon} label="Resume" disabled={!resumable} onClick={() => void resume(selectedHashes())} />
      <Tool icon={PauseIcon} label="Pause" disabled={!pausable} onClick={() => void pause(selectedHashes())} />
      <Tool
        icon={Trash2Icon}
        label="Remove"
        shortcut="Del"
        disabled={!hasSelection}
        onClick={() => confirmRemove(selectedHashes())}
      />
      <Separator orientation="vertical" className="mx-1 h-5!" />
      <Tool
        icon={FolderOpenIcon}
        label="Open folder"
        disabled={!hasSelection}
        onClick={() => {
          const [first] = selectedHashes()
          if (first !== undefined) void openFolder(first)
        }}
      />
      <div className="ml-auto" />
      <Tool icon={SettingsIcon} label="Settings" shortcut="Ctrl+," onClick={openSettings} />
    </header>
  )
}
