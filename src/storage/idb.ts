import type { KeyValueStore, RepositoryCache } from '../store/types'

const DATABASE = 'forgepress'
const STORE = 'changes'

const CACHE = 'forgepress-cache'
const FILES = 'files'
const LISTINGS = 'listings'

const STORES: Record<string, readonly string[]> = {
  [DATABASE]: [STORE],
  [CACHE]: [FILES, LISTINGS],
}

interface StoredListing {
  commit: string
  files: ReadonlyMap<string, string>
}

function settle<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('[forgepress] IndexedDB request failed'))
  })
}

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(name, 1)

    opening.onupgradeneeded = () => {
      for (const store of STORES[name] ?? []) {
        if (!opening.result.objectStoreNames.contains(store))
          opening.result.createObjectStore(store)
      }
    }

    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error ?? new Error('[forgepress] IndexedDB is unavailable'))
    opening.onblocked = () => reject(new Error('[forgepress] IndexedDB is blocked by another open tab'))
  })
}

const databases = new Map<string, Promise<IDBDatabase>>()

async function transact<TResult>(name: string, store: string, mode: IDBTransactionMode, run: (objects: IDBObjectStore) => Promise<TResult>): Promise<TResult> {
  let database = databases.get(name)

  if (!database) {
    database = open(name)
    databases.set(name, database)
  }

  const connection = await database

  return await run(connection.transaction(store, mode).objectStore(store))
}

export function createIdbStore<TValue>(key: string): KeyValueStore<TValue> {
  return {
    read: () => transact(DATABASE, STORE, 'readonly', objects => settle(objects.get(key) as IDBRequest<TValue | undefined>)),

    write: async (value) => {
      await transact(DATABASE, STORE, 'readwrite', objects => settle(objects.put(value, key)))
    },

    clear: async () => {
      await transact(DATABASE, STORE, 'readwrite', objects => settle(objects.delete(key)))
    },
  }
}

export function createIdbCache(): RepositoryCache {
  return {
    readListing: async (commit, directory) => {
      const stored = await transact(CACHE, LISTINGS, 'readonly', objects => settle(objects.get(directory) as IDBRequest<StoredListing | undefined>))

      return stored?.commit === commit ? stored.files : undefined
    },

    writeListing: async (commit, directory, files) => {
      await transact(CACHE, LISTINGS, 'readwrite', objects => settle(objects.put({ commit, files } satisfies StoredListing, directory)))
    },

    keep: hashes => transact(CACHE, FILES, 'readwrite', objects => new Promise((resolve, reject) => {
      const keys = objects.getAllKeys()
      const values = objects.getAll()

      keys.onerror = () => reject(keys.error ?? new Error('[forgepress] IndexedDB request failed'))
      values.onerror = () => reject(values.error ?? new Error('[forgepress] IndexedDB request failed'))

      values.onsuccess = () => {
        const kept = new Map<string, string>()

        keys.result.forEach((key, index) => {
          if (typeof key === 'string' && hashes.has(key))
            kept.set(key, values.result[index] as string)
          else
            objects.delete(key)
        })

        resolve(kept)
      }
    })),

    writeFile: async (hash, text) => {
      await transact(CACHE, FILES, 'readwrite', objects => settle(objects.put(text, hash)))
    },

    clear: async () => {
      await Promise.all([FILES, LISTINGS].map(store => transact(CACHE, store, 'readwrite', objects => settle(objects.clear()))))
    },
  }
}
