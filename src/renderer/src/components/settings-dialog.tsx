import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { themes, type Theme } from '@shared/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { saveSettings } from '@/lib/actions'
import { run } from '@/lib/api'
import { cn } from '@/lib/utils'
import { closeDialog, useDialog } from '@/store/dialogs'
import { setSettings, useSettings, useSystemAccent, useThemePreference, type SettingsValue } from '@/store/settings'
import { useUpdates, type UpdateStatusValue } from '@/store/updates'
import { SaveFolderField } from './save-folder-field'

const kibibyte = 1024

const themeOptions = {
  dark: { label: 'Dark', icon: MoonIcon },
  light: { label: 'Light', icon: SunIcon },
  system: { label: 'System', icon: MonitorIcon },
} as const satisfies Record<Theme, { label: string; icon: LucideIcon }>

/** Bytes per second shown as whole KiB/s; empty means unlimited. */
const limitToText = (limit: number | null) => (limit === null ? '' : String(Math.round(limit / kibibyte)))

/** Parses a KiB/s field into bytes per second: null for empty (unlimited), undefined for invalid input. */
const textToLimit = (text: string) => {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const kib = Number(trimmed)
  return Number.isInteger(kib) && kib > 0 ? kib * kibibyte : undefined
}

const LimitField = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) => {
  const id = useId()
  const invalid = textToLimit(value) === undefined
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="Unlimited"
        value={value}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
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

/** Applies the theme and accent on click, outside the save flow, so the choice is previewed right away. */
const ThemeField = () => {
  const current = useThemePreference()
  const systemAccent = useSystemAccent()
  return (
    <>
      <SwitchField
        label="Use system accent color"
        checked={systemAccent}
        onChange={(useSystemAccent) => void saveSettings({ useSystemAccent })}
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
                variant="outline"
                className={cn(
                  theme === current &&
                    'border-highlight bg-highlight text-highlight-foreground hover:bg-highlight/90 hover:text-highlight-foreground dark:border-highlight dark:bg-highlight dark:hover:bg-highlight/90',
                )}
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

const SettingsForm = ({ initial }: { readonly initial: SettingsValue }) => {
  const [downloadFolder, setDownloadFolder] = useState(initial.downloadFolder)
  const [downloadLimit, setDownloadLimit] = useState(limitToText(initial.downloadLimit))
  const [uploadLimit, setUploadLimit] = useState(limitToText(initial.uploadLimit))
  const [startMinimized, setStartMinimized] = useState(initial.startMinimized)
  const [launchOnStartup, setLaunchOnStartup] = useState(initial.launchOnStartup)
  const [busy, setBusy] = useState(false)

  const parsedDown = textToLimit(downloadLimit)
  const parsedUp = textToLimit(uploadLimit)
  const folder = downloadFolder.trim()
  const valid = parsedDown !== undefined && parsedUp !== undefined && folder !== ''
  // the theme is saved on click, so only the fields below decide whether there is anything to save
  const changed =
    folder !== initial.downloadFolder ||
    parsedDown !== initial.downloadLimit ||
    parsedUp !== initial.uploadLimit ||
    startMinimized !== initial.startMinimized ||
    launchOnStartup !== initial.launchOnStartup

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (parsedDown === undefined || parsedUp === undefined || folder === '') return
    setBusy(true)
    const result = await run('settings.update', {
      downloadFolder: folder,
      downloadLimit: parsedDown,
      uploadLimit: parsedUp,
      startMinimized,
      launchOnStartup,
    })
    setBusy(false)
    if (!result.ok) return
    setSettings(result.value)
    closeDialog()
  }

  return (
    <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <SaveFolderField label="Default download folder" value={downloadFolder} onChange={setDownloadFolder} />
        <div className="grid grid-cols-2 gap-4">
          <LimitField label="Download limit, KiB/s" value={downloadLimit} onChange={setDownloadLimit} />
          <LimitField label="Upload limit, KiB/s" value={uploadLimit} onChange={setUploadLimit} />
        </div>
        <Separator />
        <SwitchField label="Launch on startup" checked={launchOnStartup} onChange={setLaunchOnStartup} />
        <SwitchField label="Start minimized to tray" checked={startMinimized} onChange={setStartMinimized} />
        <Separator />
        <ThemeField />
        <Separator />
        <UpdateSection />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid || !changed || busy}>
            Save
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

export const SettingsDialog = () => {
  const dialog = useDialog('settings')
  const settings = useSettings((state) => state.settings)
  return (
    <Dialog
      open={dialog !== null && settings !== null}
      onOpenChange={(open) => {
        if (!open) closeDialog()
      }}
    >
      {dialog !== null && settings !== null && <SettingsForm initial={settings} />}
    </Dialog>
  )
}
