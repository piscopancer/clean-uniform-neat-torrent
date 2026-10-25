import { FolderOpenIcon } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pickFolder } from '@/lib/actions'

type SaveFolderFieldProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly label?: string
}

/** Folder path input with a native folder picker button. */
export const SaveFolderField = ({ value, onChange, label = 'Save to' }: SaveFolderFieldProps) => {
  const id = useId()
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Browse"
          onClick={async () => {
            const picked = await pickFolder(value)
            if (picked !== null) onChange(picked)
          }}
        >
          <FolderOpenIcon />
        </Button>
      </div>
    </div>
  )
}
