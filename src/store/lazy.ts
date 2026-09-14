import type { MediaClient } from '../media/types'
import type { ContentStore } from './types'

export function lazyStore(select: () => Promise<ContentStore>): ContentStore {
  let selected: Promise<ContentStore> | undefined

  function store(): Promise<ContentStore> {
    selected ??= select()

    return selected
  }

  return {
    schema: async () => (await store()).schema(),
    list: async collection => (await store()).list(collection),
    entry: async (collection, id) => (await store()).entry(collection, id),
    writeEntry: async (collection, row) => (await store()).writeEntry(collection, row),
    removeEntry: async (collection, id) => (await store()).removeEntry(collection, id),
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
