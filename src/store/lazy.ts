import type { MediaClient } from '../media/types'
import type { ContentStore } from './types'

export function lazyStore(select: () => Promise<ContentStore>): ContentStore {
  return {
    schema: async () => (await select()).schema(),
    list: async collection => (await select()).list(collection),
    entry: async (collection, id) => (await select()).entry(collection, id),
    writeEntry: async (collection, row) => (await select()).writeEntry(collection, row),
    removeEntry: async (collection, id) => (await select()).removeEntry(collection, id),
  }
}

export function lazyMedia(select: () => Promise<MediaClient>): MediaClient {
  return {
    list: async () => (await select()).list(),
    upload: async file => (await select()).upload(file),
    remove: async name => (await select()).remove(name),
  }
}
