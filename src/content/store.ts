import type { MediaClient } from '../types/content/media'
import type { ContentStore, KeyValueStore } from '../types/content/store'
import { createMemoryStore } from './changes'
import { createIdbStore } from './changes/idb'

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
    list: async component => (await store()).list(component),
    writeSchema: async schema => (await store()).writeSchema(schema),
    writeContent: async (component, rows) => (await store()).writeContent(component, rows),
    removeContent: async component => (await store()).removeContent(component),
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
