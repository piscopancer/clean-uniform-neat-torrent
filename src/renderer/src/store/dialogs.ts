import { create } from 'zustand'
import type { InfoHash } from '@/lib/api'

export type Dialog =
  | { readonly kind: 'addMagnet'; readonly magnet: string }
  | { readonly kind: 'addFiles'; readonly paths: ReadonlyArray<string> }
  | { readonly kind: 'remove'; readonly infoHashes: ReadonlyArray<InfoHash> }
  | { readonly kind: 'settings' }

type DialogOf<K extends Dialog['kind']> = Extract<Dialog, { readonly kind: K }>

/** The single modal dialog currently open, if any. */
export const useDialogs = create<{ readonly dialog: Dialog | null }>(() => ({ dialog: null }))

export const openDialog = (dialog: Dialog) => useDialogs.setState({ dialog })

export const closeDialog = () => useDialogs.setState({ dialog: null })

const isKind = <const K extends Dialog['kind']>(dialog: Dialog | null, kind: K): dialog is DialogOf<K> =>
  dialog?.kind === kind

/** The open dialog narrowed to one kind, or null when another one or none is open. */
export const useDialog = <const K extends Dialog['kind']>(kind: K) =>
  useDialogs((state) => (isKind(state.dialog, kind) ? state.dialog : null))
