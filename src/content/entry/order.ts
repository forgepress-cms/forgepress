import type { EntryMeta } from '../../types/core/entry'

function compareCreation(left: EntryMeta, right: EntryMeta): number {
  if (left.createdAt !== right.createdAt)
    return left.createdAt < right.createdAt ? -1 : 1

  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

export function sortByCreation<TEntry extends EntryMeta>(entries: readonly TEntry[]): TEntry[] {
  return [...entries].sort(compareCreation)
}
