import type { RepoTarget } from '../forge/types'
import type { MediaSource } from '../media/types'
import type { ContentSource } from '../store/types'
import type { Previews } from './previews'
import type { Changes, FileDiff } from './types'
import { serializeEntry } from '../files/serialize'
import { storedAsset } from '../media'
import { changedEntries, changedMedia } from './files'
import { diffLines } from './lines'

async function entryDiffs(changes: Changes, base: ContentSource, target: RepoTarget): Promise<FileDiff[]> {
  const diffs = await Promise.all(changedEntries(changes, target).map(async ({ path, collection, id, row }): Promise<FileDiff> => {
    const previous = await base.entry(collection, id)
    const before = previous ? serializeEntry(collection, previous, target.format) : ''

    if (row === null)
      return { path, change: 'removed', lines: diffLines(before, '') }

    return { path, change: before ? 'changed' : 'added', lines: diffLines(before, serializeEntry(collection, row, target.format)) }
  }))

  return diffs.sort((left, right) => left.path.localeCompare(right.path))
}

async function mediaDiffs(changes: Changes, media: MediaSource, previews: Previews, target: RepoTarget): Promise<FileDiff[]> {
  const changed = changedMedia(changes, target)

  if (changed.length === 0)
    return []

  const { url } = await media.settings()
  const stored = changed.some(file => !file.upload) ? new Set(await media.stored()) : new Set<string>()

  return changed.map(({ path, name, upload }): FileDiff => {
    if (upload)
      return { path, change: 'added', after: previews.asset(upload, url) }

    const published = changes.publishedMedia?.[name]
    const before = published ? previews.asset(published, url) : stored.has(name) ? storedAsset(name, url) : undefined

    return { path, change: 'removed', ...before ? { before } : {} }
  })
}

export async function diffChanges(
  changes: Changes,
  base: ContentSource,
  media: MediaSource,
  previews: Previews,
  target: RepoTarget,
): Promise<FileDiff[]> {
  return [
    ...await entryDiffs(changes, base, target),
    ...await mediaDiffs(changes, media, previews, target),
  ]
}
