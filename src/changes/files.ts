import type { FileChange, RepoTarget } from '../forge/types'
import type { PendingUpload } from '../media/types'
import type { Entry } from '../types/entry'
import type { Changes } from './types'
import { prefixer } from '../files/paths'
import { serializeEntry } from '../files/serialize'
import { toBase64 } from '../utils/encoding'

export interface ChangedEntry {
  path: string
  collection: string
  id: string
  row: Entry | null
  hash: string | null | undefined
}

export interface ChangedMedia {
  path: string
  name: string
  upload: PendingUpload | undefined
}

export function changedEntries(changes: Changes, target: RepoTarget): ChangedEntry[] {
  const at = prefixer(target.base)

  return Object.entries(changes.entries).flatMap(([collection, overlay]) => Object.entries(overlay).map(([id, row]) => ({
    path: at(target.paths.entry(collection, id)),
    collection,
    id,
    row,
    hash: changes.hashes?.entries[collection]?.[id],
  })))
}

export function changedMedia(changes: Changes, target: RepoTarget): ChangedMedia[] {
  const prefix = prefixer(target.base)
  const at = (name: string): string => prefix(`${target.mediaDir}/${name}`)

  return [
    ...Object.values(changes.uploads).map(upload => ({ path: at(upload.name), name: upload.name, upload })),
    ...changes.removed.map(name => ({ path: at(name), name, upload: undefined })),
  ]
}

export function toFiles(changes: Changes, target: RepoTarget): FileChange[] {
  const entries = changedEntries(changes, target).map((entry): FileChange => {
    const known = entry.hash === undefined ? {} : { replaces: entry.hash }

    return entry.row === null
      ? { path: entry.path, removed: true, ...known }
      : { path: entry.path, data: serializeEntry(entry.collection, entry.row, target.format), encoding: 'utf-8', ...known }
  })

  const media = changedMedia(changes, target).map((file): FileChange => file.upload
    ? { path: file.path, data: toBase64(file.upload.data), encoding: 'base64' }
    : { path: file.path, removed: true })

  return [...entries, ...media]
}
