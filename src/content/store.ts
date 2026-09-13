import type { MediaClient } from '../types/content/media'
import type { ContentStore, KeyValueStore } from '../types/content/store'
import { createIdbStore } from './storage/idb'
import { createMemoryStore } from './storage/memory'

export function persist<TValue>(key: string): KeyValueStore<TValue> {
  return typeof indexedDB === 'undefined' ? createMemoryStore<TValue>() : createIdbStore<TValue>(key)
}

export function lazyStore(select: () => Promise<ContentStore>): ContentStore {
  let selected: Promise<ContentStore> | undefined

  function store(): Promise<ContentStore> {
    selected ??= select()

    return selected
  }

  return {
    schema: async () => (await store()).schema(),
    list: async collection => (await store()).list(collection),
    index: async collection => (await store()).index(collection),
    entry: async (collection, id) => (await store()).entry(collection, id),
    writeSchema: async schema => (await store()).writeSchema(schema),
    writeEntry: async (collection, row) => (await store()).writeEntry(collection, row),
    removeEntry: async (collection, id) => (await store()).removeEntry(collection, id),
    writeContent: async (collection, rows) => (await store()).writeContent(collection, rows),
    removeCollection: async collection => (await store()).removeCollection(collection),
  }
}

export function lazyMedia(select: () => Promise<MediaClient>): MediaClient {
  let selected: Promise<MediaClient> | undefined

  function client(): Promise<MediaClient> {
    selected ??= select()

    return selected
  }

  return {
    list: async () => (await client()).list(),
    upload: async file => (await client()).upload(file),
    remove: async name => (await client()).remove(name),
  }
}
