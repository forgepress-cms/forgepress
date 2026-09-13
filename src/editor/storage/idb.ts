import type { KeyValueStore } from '../../store/types'

const DATABASE = 'forgepress'
const STORE = 'changes'

function settle<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('[forgepress] IndexedDB request failed'))
  })
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1)

    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE))
        opening.result.createObjectStore(STORE)
    }

    opening.onsuccess = () => resolve(opening.result)
    opening.onerror = () => reject(opening.error ?? new Error('[forgepress] IndexedDB is unavailable'))
    opening.onblocked = () => reject(new Error('[forgepress] IndexedDB is blocked by another open tab'))
  })
}

let database: Promise<IDBDatabase> | undefined

export function createIdbStore<TValue>(key: string): KeyValueStore<TValue> {
  async function transact<TResult>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<TResult>): Promise<TResult> {
    database ??= open()

    const connection = await database

    return await settle(run(connection.transaction(STORE, mode).objectStore(STORE)))
  }

  return {
    read: () => transact('readonly', store => store.get(key) as IDBRequest<TValue | undefined>),

    write: async (value) => {
      await transact('readwrite', store => store.put(value, key))
    },

    clear: async () => {
      await transact('readwrite', store => store.delete(key))
    },
  }
}
