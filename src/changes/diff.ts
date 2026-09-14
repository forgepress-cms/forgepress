import type { RepoTarget } from '../forge/types'
import type { BakedMedia } from '../media/types'
import type { ContentSource } from '../store/types'
import type { Previews } from './previews'
import type { Changes, FileDiff } from './types'
import { serializeEntry } from '../files/serialize'
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

function mediaDiffs(changes: Changes, baked: BakedMedia, previews: Previews, target: RepoTarget): FileDiff[] {
  return changedMedia(changes, target).map(({ path, name, upload }): FileDiff => {
    if (upload)
      return { path, change: 'added', after: previews.asset(upload, baked.url) }

    const found = baked.assets.find(item => item.name === name)

    return { path, change: 'removed', ...found ? { before: found } : {} }
  })
}

export async function diffChanges(
  changes: Changes,
  base: ContentSource,
  baked: BakedMedia,
  previews: Previews,
  target: RepoTarget,
): Promise<FileDiff[]> {
  return [
    ...await entryDiffs(changes, base, target),
    ...mediaDiffs(changes, baked, previews, target),
  ]
}
