import type { BakedMedia, PendingUpload } from '../media/types'
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

    await store.write(changes)
  }

  return {
    content: createContentChanges(base, ready, mutate),
    media: createMediaChanges(baked, previews, ready, mutate),

    snapshot: ready,

    summary: async () => {
      const changes = await ready()

      return {
        schema: changes.schema !== undefined,
        written: refs(changes, true),
        discarded: refs(changes, false),
        dropped: [...changes.dropped],
        uploaded: Object.keys(changes.uploads),
        deleted: [...changes.removed],
      } satisfies ChangeSummary
    },

    diff: async target => diffChanges(await ready(), base, await baked(), previews, target),

    published: async () => {
      const changes = await ready()
      const deployed = new Set((await baked()).assets.map(asset => asset.name))
      const media: Record<string, PendingUpload | null> = {}

      for (const [name, upload] of Object.entries(changes.publishedMedia ?? {})) {
        if (upload ? !deployed.has(name) : deployed.has(name))
          media[name] = upload
        else
          previews.forget(name)
      }

      for (const [name, upload] of Object.entries(changes.uploads))
        media[name] = upload

      for (const name of changes.removed)
        media[name] = null

      const next: Changes = { ...empty(), ...Object.keys(media).length > 0 ? { publishedMedia: media } : {} }

      loaded = Promise.resolve(next)

      await (next.publishedMedia ? store.write(next) : store.clear())
    },

    discard: async () => {
      const { publishedMedia } = await ready()
      const next: Changes = { ...empty(), ...publishedMedia ? { publishedMedia } : {} }

      previews.clear()
      loaded = Promise.resolve(next)

      await (publishedMedia ? store.write(next) : store.clear())
    },
  }
}
