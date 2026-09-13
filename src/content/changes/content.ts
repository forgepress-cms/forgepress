import type { Changes } from '../../types/content/changes'
import type { ContentRow, ContentSource } from '../../types/content/reader'
import type { ContentStore } from '../../types/content/store'
import { toMeta } from '../entry/meta'
import { sortByCreation } from '../entry/order'
import { plain } from '../value'
import { discardAll, mergeEntries, reconcile, stage } from './entries'

export type Mutate = (apply: (changes: Changes) => void) => Promise<void>
export type Ready = () => Promise<Changes>

export function createContentChanges(base: ContentSource, ready: Ready, mutate: Mutate): ContentStore {
  async function rows(collection: string): Promise<ContentRow[]> {
    const changes = await ready()

    if (changes.dropped.includes(collection))
      return []

    return sortByCreation(mergeEntries(await base.list(collection), changes.entries[collection]))
  }

  return {
    schema: async () => (await ready()).schema ?? await base.schema(),

    list: rows,

    index: async collection => (await rows(collection)).map(toMeta),

    entry: async (collection, id) => {
      const changes = await ready()

      if (changes.dropped.includes(collection))
        return undefined

      const staged = changes.entries[collection]?.[id]

      if (staged !== undefined)
        return staged ?? undefined

      return base.entry(collection, id)
    },

    writeSchema: schema => mutate((changes) => {
      changes.schema = plain(schema)
    }),

    writeEntry: async (collection, row) => {
      const before = await base.entry(collection, row.id)

      await mutate((changes) => {
        stage(changes.entries[collection] ??= {}, before, plain(row))
        changes.dropped = changes.dropped.filter(name => name !== collection)
      })
    },

    removeEntry: async (collection, id) => {
      const before = await base.entry(collection, id)

      await mutate((changes) => {
        const overlay = changes.entries[collection] ??= {}

        if (before)
          overlay[id] = null
        else
          delete overlay[id]
      })
    },

    writeContent: async (collection, next) => {
      const existing = await base.list(collection)

      await mutate((changes) => {
        reconcile(changes.entries[collection] ??= {}, existing, plain(next))
        changes.dropped = changes.dropped.filter(name => name !== collection)
      })
    },

    removeCollection: async (collection) => {
      const existing = await base.list(collection)

      await mutate((changes) => {
        const overlay: Record<string, ContentRow | null> = {}

        discardAll(overlay, existing)
        changes.entries[collection] = overlay

        if (!changes.dropped.includes(collection))
          changes.dropped.push(collection)
      })
    },
  }
}
