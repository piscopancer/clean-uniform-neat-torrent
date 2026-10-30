import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { themes, type Theme, type TorrentLimits } from '@shared/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { saveSettings } from '@/lib/actions'
import { run } from '@/lib/api'
import { digitsToLimit, limitToText } from '@/lib/format'
import { onDialogOpenChange, useKeptDialog } from '@/store/dialogs'
import { useExtraVisuals, useSettings, useSystemAccent, useThemePreference } from '@/store/settings'
import { useUpdates, type UpdateStatusValue } from '@/store/updates'
import { SaveFolderField, savePathProblem } from './save-folder-field'
import { limitPatches, PillField, PillInput, SpeedPill } from './speed-pill'

const themeOptions = {
  dark: { label: 'Dark', icon: MoonIcon },
  light: { label: 'Light', icon: SunIcon },
  system: { label: 'System', icon: MonitorIcon },
} as const satisfies Record<Theme, { label: string; icon: LucideIcon }>

/** Settings as last loaded or saved, read once as a field mounts; the dialog only opens once they are there. */
const currentSettings = () => useSettings.getState().settings

/** Parses a global limit field into bytes per second: null for empty (unlimited), undefined for 0, which only a single torrent may take. */
const textToLimit = (digits: string) => {
  const limit = digitsToLimit(digits)
  return limit === 0 ? undefined : limit
}

/** One half of the global limit pill, saved as it is typed and marked invalid, unsaved, while it holds 0. */
const GlobalLimitHalf = ({ limitKey }: { limitKey: keyof TorrentLimits }) => {
  // the field owns its text from here on, so a save never rewrites what is being typed
  const [text, setText] = useState(() => limitToText(currentSettings()?.[limitKey] ?? null))
  const change = (digits: string) => {
    setText(digits)
    const limit = textToLimit(digits)
    if (limit !== undefined) void saveSettings(limitPatches[limitKey](limit))
  }
  return (
    <PillField limitKey={limitKey}>
      <PillInput limitKey={limitKey} value={text} aria-invalid={textToLimit(text) === undefined} onDigits={change} />
    </PillField>
  )
}

/** Both global limits in one pill, under a heading that sets them apart from the limits of single torrents. */
const GlobalLimitField = () => (
  <div className="grid gap-2">
    <div className="grid gap-0.5">
      <span className="text-sm font-medium">
        Global speed limit
        <span className="ml-2 font-normal text-muted-foreground">KiB/s</span>
      </span>
      <p className="text-xs text-muted-foreground">
        Caps all torrents together. A limit set on a single torrent from its right-click menu applies on top of this one
        and can only slow that torrent further.
      </p>
    </div>
    <div className="flex text-muted-foreground">
      <SpeedPill
        fill
        size="md"
        className="rounded-md"
        down={<GlobalLimitHalf limitKey="downloadLimit" />}
        up={<GlobalLimitHalf limitKey="uploadLimit" />}
      />
    </div>
  </div>
)

const savedFolder = () => currentSettings()?.downloadFolder ?? ''

/** Saves a typed folder once it is a well-formed path other than the saved one. */
const saveFolder = (text: string) => {
  const folder = text.trim()
  if (folder === '' || folder === savedFolder() || savePathProblem(folder) !== null) return
  void saveSettings({ downloadFolder: folder })
}

/** The default download folder, saved once the path is done with; an emptied field goes back to the saved folder. */
const FolderField = () => {
  const [text, setText] = useState(savedFolder)
  const latest = useRef(text)
  const change = (value: string) => {
    latest.current = value
    setText(value)
  }
  // the dialog may close while the field still has focus, and an unmounted field never blurs
  useEffect(() => () => saveFolder(latest.current), [])
  const commit = (value: string) => {
    if (value.trim() === '') change(savedFolder())
    else saveFolder(value)
  }
  return <SaveFolderField label="Default download folder" value={text} onChange={change} onCommit={commit} />
}

const SwitchField = ({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

const StartupFields = () => {
  const launchOnStartup = useSettings((state) => state.settings?.launchOnStartup ?? false)
  const startMinimized = useSettings((state) => state.settings?.startMinimized ?? false)
  return (
    <>
      <SwitchField
        label="Launch on startup"
        checked={launchOnStartup}
        onChange={(launchOnStartup) => void saveSettings({ launchOnStartup })}
      />
      <SwitchField
        label="Start minimized to tray"
        checked={startMinimized}
        onChange={(startMinimized) => void saveSettings({ startMinimized })}
      />
    </>
  )
}

const ThemeField = () => {
  const current = useThemePreference()
  const systemAccent = useSystemAccent()
  const extraVisuals = useExtraVisuals()
  return (
    <>
      <SwitchField
        label="Use system accent color"
        checked={systemAccent}
        onChange={(useSystemAccent) => void saveSettings({ useSystemAccent })}
      />
      <SwitchField
        label="Extra visuals"
        checked={extraVisuals}
        onChange={(extraVisuals) => void saveSettings({ extraVisuals })}
      />
      <div className="grid gap-2">
        <Label>Theme</Label>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((theme) => {
            const { label, icon: Icon } = themeOptions[theme]
            return (
              <Button
                key={theme}
                type="button"
                variant="glass"
                // glass-toggle fills the chosen theme with the highlight, like a switch that is on
                data-state={theme === current ? 'checked' : 'unchecked'}
                aria-pressed={theme === current}
                onClick={() => void saveSettings({ theme })}
              >
                <Icon />
                {label}
              </Button>
            )
          })}
        </div>
      </div>
    </>
  )
}

const describeUpdate = (status: UpdateStatusValue) => {
  switch (status._tag) {
    case 'Idle':
      return 'Not checked yet.'
    case 'Checking':
      return 'Checking for updates…'
    case 'Available':
      return `Version ${status.version} is available and downloading.`
    case 'NotAvailable':
      return 'You are on the latest version.'
    case 'Downloading':
      return `Downloading update, ${Math.floor(status.percent)}%.`
    case 'Downloaded':
      return `Version ${status.version} is ready to install.`
    case 'ManualUpdate':
      return `Version ${status.version} is available on the release page.`
    case 'Failed':
      return `Update failed: ${status.message}`
    case 'Unsupported':
      return 'Updates are only available in the installed app.'
    default:
      return status satisfies never
  }
}

const UpdateSection = () => {
  const status = useUpdates((state) => state.status)
  const version = useUpdates((state) => state.version)
  const busy = status._tag === 'Checking' || status._tag === 'Downloading' || status._tag === 'Available'
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">
          Version
          {version !== null && <span className="ml-2 font-normal text-muted-foreground">{version}</span>}
        </span>
        <p className="text-xs text-muted-foreground">{describeUpdate(status)}</p>
      </div>
      {status._tag === 'Downloaded' ? (
        <Button type="button" size="sm" onClick={() => void run('updates.install')}>
          Restart and update
        </Button>
      ) : status._tag === 'ManualUpdate' ? (
        <Button type="button" size="sm" onClick={() => void run('updates.install')}>
          Download
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || status._tag === 'Unsupported'}
          onClick={() => void run('updates.check')}
        >
          Check now
        </Button>
      )}
    </div>
  )
}

/** Every setting applies the moment it changes, so the dialog has nothing to confirm. */
const SettingsContent = () => (
  <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
    <DialogHeader>
      <DialogTitle>Settings</DialogTitle>
    </DialogHeader>
    <DialogBody>
      <FolderField />
      <GlobalLimitField />
      <StartupFields />
      <Separator />
      <ThemeField />
      <Separator />
      <UpdateSection />
    </DialogBody>
  </DialogContent>
)

export const SettingsDialog = () => {
  const { open, kept } = useKeptDialog('settings')
  const ready = useSettings((state) => state.settings !== null)
  return (
    <Dialog open={open && ready} onOpenChange={onDialogOpenChange}>
      {kept !== null && ready && <SettingsContent key={kept.key} />}
    </Dialog>
  )
}
