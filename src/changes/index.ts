import type { BakedMedia } from '../media/types'
import type { ContentSource, KeyValueStore } from '../store/types'
import type { Changes, ChangeService, ChangeSummary, EntryRef } from './types'
import { createContentChanges } from './content'
import { diffChanges } from './diff'
import { createMediaChanges } from './media'
import { createPreviews } from './previews'

function empty(): Changes {
  return { entries: {}, dropped: [], uploads: {}, removed: [] }
}

function refs(changes: Changes, staged: boolean): EntryRef[] {
  return Object.entries(changes.entries).flatMap(([collection, overlay]) =>
    Object.entries(overlay)
      .filter(([, row]) => (row !== null) === staged)
      .map(([id]) => ({ collection, id })))
}

export function createChanges(base: ContentSource, baked: () => Promise<BakedMedia>, store: KeyValueStore<Changes>): ChangeService {
  const previews = createPreviews()

  let loaded: Promise<Changes> | undefined

  function ready(): Promise<Changes> {
    loaded ??= store.read().then(changes => changes ? { ...empty(), ...changes } : empty())

    return loaded
  }

  async function mutate(apply: (changes: Changes) => void): Promise<void> {
    const changes = await ready()

    apply(changes)

    delete changes.published

    await store.write(changes)
  }

  return {
    content: createContentChanges(base, ready, mutate),
    media: createMediaChanges(baked, previews, ready, mutate),

    snapshot: ready,

    summary: async () => {
      const changes = await ready()

      return {
        ...changes.published === undefined ? {} : { published: changes.published },
        schema: changes.schema !== undefined,
        written: refs(changes, true),
        discarded: refs(changes, false),
        dropped: [...changes.dropped],
        uploaded: Object.keys(changes.uploads),
        deleted: [...changes.removed],
      } satisfies ChangeSummary
    },

    diff: async target => diffChanges(await ready(), base, await baked(), previews, target),

    published: async (commit) => {
      const changes = await ready()

      changes.published = commit

      await store.write(changes)
    },

    discard: async () => {
      previews.clear()
      loaded = Promise.resolve(empty())

      await store.clear()
    },
  }
}
