import type { ContentSource, ContentStore } from '../store/types'
import type { Changes } from './types'
import { sortByCreation } from '../entries/order'
import { plain } from '../utils/value'
import { mergeEntries, stage } from './entries'

export type Mutate = (apply: (changes: Changes) => void) => Promise<void>
export type Ready = () => Promise<Changes>

export function createContentChanges(base: ContentSource, ready: Ready, mutate: Mutate): ContentStore {
  return {
    schema: () => base.schema(),

    list: async collection => sortByCreation(mergeEntries(await base.list(collection), (await ready()).entries[collection])),

    entry: async (collection, id) => {
      const staged = (await ready()).entries[collection]?.[id]

      if (staged !== undefined)
        return staged ?? undefined

      return base.entry(collection, id)
    },

    writeEntry: async (collection, row) => {
      const before = await base.entry(collection, row.id)

      await mutate((changes) => {
        stage(changes.entries[collection] ??= {}, before, plain(row))
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
  }
}
