import type { Output } from './api'

export type File = Output<'torrents.inspectFile'>['files'][number]

/** A row of the file tree: one file, or a folder that sums up every file below it. */
export type FileNode = {
  readonly id: string
  readonly name: string
  /** Path inside the torrent as the torrent spells it. */
  readonly path: string
  readonly size: number
  readonly progress: number
  /** Every file at or below this row, which its checkbox chooses together. */
  readonly files: ReadonlyArray<File>
  /** Rows inside a folder; undefined for a file. */
  readonly children?: ReadonlyArray<FileNode>
}

/** A folder while the tree is assembled, holding its subfolders and files in the order the torrent lists them. */
type Draft = { readonly name: string; readonly path: string; readonly items: Array<Draft | File> }

const isDraft = (item: Draft | File): item is Draft => 'items' in item

const fileNode = (file: File): FileNode => ({
  id: String(file.index),
  name: file.name,
  path: file.path,
  size: file.length,
  progress: file.progress,
  files: [file],
})

const folderNode = (draft: Draft): FileNode => {
  const children = draft.items.map((item) => (isDraft(item) ? folderNode(item) : fileNode(item)))
  const files = children.flatMap((child) => child.files)
  const size = files.reduce((total, file) => total + file.length, 0)
  const downloaded = files.reduce((total, file) => total + file.downloaded, 0)
  return {
    id: `folder:${draft.path}`,
    name: draft.name,
    path: draft.path,
    size,
    progress: size > 0 ? downloaded / size : 0,
    files,
    children,
  }
}

/**
 * Nests the flat file list of a torrent into folders by the separators in each path. Most torrents keep everything in
 * one folder named after the torrent, which tells nothing new, so a lone top folder is left out and its contents form
 * the top level.
 */
export const fileTree = (files: ReadonlyArray<File>): ReadonlyArray<FileNode> => {
  const root: Draft = { name: '', path: '', items: [] }
  const folders = new Map<string, Draft>()
  for (const file of files) {
    const segments = file.path.split(/[\\/]/)
    let parent = root
    for (const [depth, name] of segments.slice(0, -1).entries()) {
      const path = segments.slice(0, depth + 1).join('/')
      let folder = folders.get(path)
      if (folder === undefined) {
        folder = { name, path, items: [] }
        folders.set(path, folder)
        parent.items.push(folder)
      }
      parent = folder
    }
    parent.items.push(file)
  }
  const [only, ...rest] = root.items
  const top = only !== undefined && rest.length === 0 && isDraft(only) ? only : root
  return folderNode(top).children ?? []
}
