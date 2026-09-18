import { entryKey } from '../../src/entries/references'
import { toEntryRef } from '../../src/files/paths'
import { baked } from '../settings'
import { useContent } from './useContent'

export interface EntryIssues {
  of: (collection: string, id: string) => string[]
  count: (collection: string) => number
}

export async function useIssues(): Promise<EntryIssues> {
  const store = await useContent().schemaStore()
  const issues = store ? await store.issues().catch(() => []) : []
  const { paths } = await baked()
  const found = new Map<string, string[]>()

  for (const issue of issues) {
    const ref = toEntryRef(paths.content, issue.file)

    if (ref)
      found.set(entryKey(ref.collection, ref.id), [...found.get(entryKey(ref.collection, ref.id)) ?? [], issue.message])
  }

  return {
    of: (collection, id) => found.get(entryKey(collection, id)) ?? [],
    count: collection => [...found.keys()].filter(key => key.startsWith(`${collection}/`)).length,
  }
}
