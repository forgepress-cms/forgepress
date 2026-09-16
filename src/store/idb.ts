import type { KeyValueStore, RepositoryCache } from './types'
import { clear, createStore, del, delMany, entries, get, set } from 'idb-keyval'

interface StoredListing {
  commit: string
  files: ReadonlyMap<string, string>
}

const CHANGES = createStore('forgepress', 'changes')
const FILES = createStore('forgepress-cache', 'files')
const LISTINGS = createStore('forgepress-listings', 'listings')

export function createIdbStore<TValue>(key: string): KeyValueStore<TValue> {
  return {
    read: () => get<TValue>(key, CHANGES),
    write: value => set(key, value, CHANGES),
    clear: () => del(key, CHANGES),
  }
}

export function createIdbCache(): RepositoryCache {
  return {
    readListing: async (commit, directory) => {
      const stored = await get<StoredListing>(directory, LISTINGS)

      return stored?.commit === commit ? stored.files : undefined
    },

    writeListing: (commit, directory, files) => set(directory, { commit, files } satisfies StoredListing, LISTINGS),

    keep: async (hashes) => {
      const kept = new Map<string, string>()
      const stale: IDBValidKey[] = []

      for (const [key, text] of await entries<IDBValidKey, string>(FILES)) {
        if (typeof key === 'string' && hashes.has(key))
          kept.set(key, text)
        else
          stale.push(key)
      }

      if (stale.length > 0)
        await delMany(stale, FILES)

      return kept
    },

    writeFile: (hash, text) => set(hash, text, FILES),

    clear: async () => {
      await Promise.all([clear(FILES), clear(LISTINGS)])
    },
  }
}
