import { useState } from 'react'
import { create } from 'zustand'
import type { InfoHash } from '@/lib/api'

export type Dialog =
  | { readonly kind: 'addMagnet'; readonly magnet: string }
  | { readonly kind: 'addFile'; readonly path: string }
  | { readonly kind: 'remove'; readonly infoHashes: ReadonlyArray<InfoHash> }
  | { readonly kind: 'settings' }
  | { readonly kind: 'details'; readonly infoHash: InfoHash }

type DialogOf<K extends Dialog['kind']> = Extract<Dialog, { readonly kind: K }>

/** Time a closing dialog takes to fade out, so the next queued one does not swap in under its exit animation. */
const exitDuration = 250

/** The single modal dialog currently open, if any, and the dialogs waiting to open one after another once it closes. */
export const useDialogs = create<{ readonly dialog: Dialog | null; readonly queued: ReadonlyArray<Dialog> }>(() => ({
  dialog: null,
  queued: [],
}))

export const openDialog = (dialog: Dialog) => useDialogs.setState({ dialog })

/** Opens the dialogs in turn, the first right away unless another dialog is open. */
export const queueDialogs = (dialogs: ReadonlyArray<Dialog>) => {
  const { dialog, queued } = useDialogs.getState()
  const [first, ...rest] = dialogs
  if (dialog === null && first !== undefined) useDialogs.setState({ dialog: first, queued: [...queued, ...rest] })
  else useDialogs.setState({ queued: [...queued, ...dialogs] })
}

export const closeDialog = () => {
  useDialogs.setState({ dialog: null })
  if (useDialogs.getState().queued.length === 0) return
  setTimeout(() => {
    const { dialog, queued } = useDialogs.getState()
    const [next, ...rest] = queued
    if (dialog === null && next !== undefined) useDialogs.setState({ dialog: next, queued: rest })
  }, exitDuration)
}

const isKind = <const K extends Dialog['kind']>(dialog: Dialog | null, kind: K): dialog is DialogOf<K> =>
  dialog?.kind === kind

/** The open dialog narrowed to one kind, or null when another one or none is open. */
export const useDialog = <const K extends Dialog['kind']>(kind: K) =>
  useDialogs((state) => (isKind(state.dialog, kind) ? state.dialog : null))

/** Closes the dialog when Radix reports it closed by Escape, the overlay or the close button. */
export const onDialogOpenChange = (open: boolean) => {
  if (!open) closeDialog()
}

/**
 * The dialog of one kind for rendering through its exit animation: `open` drops as soon as the dialog closes, while
 * `kept` holds its last value, so the content stays on screen until it has faded out. `kept.key` changes on every
 * opening, so a form inside starts fresh instead of keeping what was typed the previous time.
 */
export const useKeptDialog = <const K extends Dialog['kind']>(kind: K) => {
  const current = useDialog(kind)
  const [kept, setKept] = useState<{ readonly dialog: DialogOf<K>; readonly key: number } | null>(null)
  if (current !== null && current !== kept?.dialog) setKept({ dialog: current, key: (kept?.key ?? 0) + 1 })
  return { open: current !== null, kept } as const
}
