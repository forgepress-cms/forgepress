import type { ContentPaths } from '../paths'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defaultPaths, isEntryFile, toCollectionName, toEntryId } from '../paths'

export interface CollectionDirectory {
  collection: string
  directory: string
  path: string
  ids: string[]
}

export function readEntryIds(path: string): string[] {
  if (!existsSync(path))
    return []

  return readdirSync(path).filter(isEntryFile).map(toEntryId).sort()
}

export function readCollections(root: string, paths: ContentPaths = defaultPaths): CollectionDirectory[] {
  const base = join(root, paths.content)

  if (!existsSync(base))
    return []

  return readdirSync(base, { withFileTypes: true })
    .filter(item => item.isDirectory())
    .map(item => ({
      collection: toCollectionName(item.name),
      directory: item.name,
      path: join(base, item.name),
      ids: readEntryIds(join(base, item.name)),
    }))
    .sort((left, right) => left.collection.localeCompare(right.collection))
}
