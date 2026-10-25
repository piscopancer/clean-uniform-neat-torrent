import { create } from 'zustand'
import type { Output } from '@/lib/api'

export type UpdateStatusValue = Output<'updates.status'>

type UpdatesState = {
  readonly status: UpdateStatusValue
  /** Running app version; null until main answers. */
  readonly version: string | null
}

/** Auto-update state mirrored from main's UpdateService. */
export const useUpdates = create<UpdatesState>(() => ({ status: { _tag: 'Idle' }, version: null }))

export const setUpdateStatus = (status: UpdateStatusValue) => useUpdates.setState({ status })

export const setAppVersion = (version: string) => useUpdates.setState({ version })
