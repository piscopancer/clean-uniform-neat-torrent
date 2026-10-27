import { useMemo } from 'react'
import { create } from 'zustand'
import { shallow } from 'zustand/shallow'
import type { InfoHash, Pushed, Summary } from '@/lib/api'

type TorrentsState = {
  /** Summaries in main's order; unchanged rows keep their identity across snapshots so memoized rows skip rendering. */
  readonly list: ReadonlyArray<Summary>
  readonly byHash: ReadonlyMap<InfoHash, Summary>
  readonly loaded: boolean
  readonly selected: ReadonlySet<InfoHash>
  /** Row a shift-click range starts from. */
  readonly anchor: InfoHash | null
  /** Name filter typed in the list bar; empty shows every torrent. */
  readonly query: string
}

export const useTorrents = create<TorrentsState>(() => ({
  list: [],
  byHash: new Map(),
  loaded: false,
  selected: new Set(),
  anchor: null,
  query: '',
}))

/** Merges a progress snapshot, reusing equal summaries and dropping the selection of torrents that are gone. */
export const applySnapshot = (snapshot: Pushed<'progress'>) =>
  useTorrents.setState((state) => {
    const list = snapshot.torrents.map((next) => {
      const previous = state.byHash.get(next.infoHash)
      return previous !== undefined && shallow(previous, next) ? previous : next
    })
    const byHash = new Map(list.map((torrent) => [torrent.infoHash, torrent]))
    const selected = new Set([...state.selected].filter((infoHash) => byHash.has(infoHash)))
    return {
      list,
      byHash,
      loaded: true,
      selected: selected.size === state.selected.size ? state.selected : selected,
      anchor: state.anchor !== null && byHash.has(state.anchor) ? state.anchor : null,
    }
  })

export type SelectMode = 'replace' | 'toggle' | 'range'

/** Updates the selection like a file manager; `order` is the visible row order, needed for ranges. */
export const selectRow = (infoHash: InfoHash, mode: SelectMode, order: ReadonlyArray<InfoHash>) =>
  useTorrents.setState((state) => {
    switch (mode) {
      case 'replace':
        return { selected: new Set([infoHash]), anchor: infoHash }
      case 'toggle': {
        const selected = new Set(state.selected)
        if (!selected.delete(infoHash)) selected.add(infoHash)
        return { selected, anchor: infoHash }
      }
      case 'range': {
        const to = order.indexOf(infoHash)
        const anchorIndex = state.anchor === null ? -1 : order.indexOf(state.anchor)
        const from = anchorIndex === -1 ? to : anchorIndex
        return { selected: new Set(order.slice(Math.min(from, to), Math.max(from, to) + 1)) }
      }
      default:
        return mode satisfies never
    }
  })

export const selectAll = () => useTorrents.setState((state) => ({ selected: new Set(state.byHash.keys()) }))

export const clearSelection = () => useTorrents.setState({ selected: new Set(), anchor: null })

/** Per-row selector so a row re-renders only when its own summary changes. */
export const useTorrent = (infoHash: InfoHash) => useTorrents((state) => state.byHash.get(infoHash))

export const useIsSelected = (infoHash: InfoHash) => useTorrents((state) => state.selected.has(infoHash))

export const setQuery = (query: string) => useTorrents.setState({ query })

/** Torrents whose name contains the search query, ignoring case; the same array while neither input changes. */
export const useVisibleList = () => {
  const list = useTorrents((state) => state.list)
  const query = useTorrents((state) => state.query.trim().toLowerCase())
  return useMemo(
    () => (query === '' ? list : list.filter((torrent) => torrent.name.toLowerCase().includes(query))),
    [list, query],
  )
}

/** Reads the selection outside React, for actions triggered by clicks and shortcuts. */
export const selectedHashes = () => [...useTorrents.getState().selected]
