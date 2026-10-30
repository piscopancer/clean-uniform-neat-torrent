import { FolderOpenIcon } from 'lucide-react'
import { useId } from 'react'
import { pathProblem } from '@shared/paths'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pickFolder } from '@/lib/actions'
import { api } from '@/lib/api'

/** Why a typed folder cannot be saved to, checked the way main will; null when it can, and for an empty field, which falls back to a default. */
export const savePathProblem = (path: string) => {
  const folder = path.trim()
  return folder === '' ? null : pathProblem(folder, api.pathStyle)
}

type SaveFolderFieldProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  /** Called when the path is done with: on blur, on Enter, and once a folder is picked. */
  readonly onCommit?: (value: string) => void
  readonly label?: string
}

/** Folder path input with a native folder picker button, marking a malformed path with the reason under it. */
export const SaveFolderField = ({ value, onChange, onCommit, label = 'Save to' }: SaveFolderFieldProps) => {
  const id = useId()
  const problemId = useId()
  const problem = savePathProblem(value)
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          spellCheck={false}
          aria-invalid={problem !== null}
          aria-describedby={problem === null ? undefined : problemId}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onCommit?.(event.currentTarget.value)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Browse"
          onClick={async () => {
            const picked = await pickFolder(value)
            if (picked === null) return
            onChange(picked)
            onCommit?.(picked)
          }}
        >
          <FolderOpenIcon />
        </Button>
      </div>
      {problem !== null && (
        <p id={problemId} className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </div>
  )
}
