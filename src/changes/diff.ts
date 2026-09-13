import type { RepoTarget } from '../forge/types'
import type { BakedMedia } from '../media/types'
import type { ContentSource } from '../store/types'
import type { Previews } from './previews'
import type { Changes, FileDiff } from './types'
import { prefixer } from '../files/paths'
import { serializeEntry, serializeSchema } from '../files/serialize'
import { diffLines } from './lines'

async function schemaDiff(changes: Changes, base: ContentSource, target: RepoTarget, at: (path: string) => string): Promise<FileDiff[]> {
  if (changes.schema === undefined)
    return []

  return [{
    path: at(target.paths.schema),
    change: 'changed',
    lines: diffLines(serializeSchema(await base.schema(), target.format), serializeSchema(changes.schema, target.format)),
  }]
}

async function entryDiffs(changes: Changes, base: ContentSource, target: RepoTarget, at: (path: string) => string): Promise<FileDiff[]> {
  const diffs: FileDiff[] = []

  for (const [collection, overlay] of Object.entries(changes.entries)) {
    for (const [id, row] of Object.entries(overlay)) {
      const path = at(target.paths.entry(collection, id))
      const previous = await base.entry(collection, id)
      const before = previous ? serializeEntry(collection, previous, target.format) : ''

      if (row === null) {
        diffs.push({ path, change: 'removed', lines: diffLines(before, '') })

        continue
      }

      const after = serializeEntry(collection, row, target.format)

      diffs.push({ path, change: before ? 'changed' : 'added', lines: diffLines(before, after) })
    }
  }

  return diffs.sort((left, right) => left.path.localeCompare(right.path))
}

function mediaDiffs(changes: Changes, baked: BakedMedia, previews: Previews, target: RepoTarget, at: (path: string) => string): FileDiff[] {
  const diffs: FileDiff[] = []

  for (const upload of Object.values(changes.uploads))
    diffs.push({ path: at(`${target.mediaDir}/${upload.name}`), change: 'added', after: previews.asset(upload, baked.url) })

  for (const name of changes.removed) {
    const found = baked.assets.find(item => item.name === name)

    diffs.push({ path: at(`${target.mediaDir}/${name}`), change: 'removed', ...found ? { before: found } : {} })
  }

  return diffs
}

export async function diffChanges(
  changes: Changes,
  base: ContentSource,
  baked: BakedMedia,
  previews: Previews,
  target: RepoTarget,
): Promise<FileDiff[]> {
  const at = prefixer(target.base)

  return [
    ...await schemaDiff(changes, base, target, at),
    ...await entryDiffs(changes, base, target, at),
    ...mediaDiffs(changes, baked, previews, target, at),
  ]
}
