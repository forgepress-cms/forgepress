import type { HashSource } from '../forge/types'
import type { MediaSource, PendingUpload } from '../media/types'
import type { ContentSource, KeyValueStore } from '../store/types'
import type { EntryRef } from '../types/entry'
import type { ChangeHashes, Changes, ChangeService, ChangeSummary } from './types'
import { createContentChanges } from './content'
import { diffChanges } from './diff'
import { changedEntries, toFiles } from './files'
import { createMediaChanges, publishedUploads } from './media'
import { createPreviews } from './previews'

function empty(): Changes {
  return { entries: {}, uploads: {}, removed: [] }
}

function refs(changes: Changes, staged: boolean): EntryRef[] {
  return Object.entries(changes.entries).flatMap(([collection, overlay]) =>
    Object.entries(overlay)
      .filter(([, row]) => (row !== null) === staged)
      .map(([id]) => ({ collection, id })))
}

export function createChanges(base: ContentSource, media: MediaSource, store: KeyValueStore<Changes>, hashes?: HashSource): ChangeService {
  const previews = createPreviews()
  const listeners = new Set<() => void>()

  let loaded: Promise<Changes> | undefined

  function notify(): void {
    for (const listener of listeners)
      listener()
  }

  function ready(): Promise<Changes> {
    loaded ??= store.read().then(changes => changes ? { ...empty(), ...changes } : empty())

    return loaded
  }

  async function track(changes: Changes): Promise<void> {
    if (!hashes)
      return

    const known = changes.hashes
    const next: ChangeHashes = { entries: {} }

    for (const [collection, overlay] of Object.entries(changes.entries)) {
      const recorded: Record<string, string | null> = {}

      for (const id of Object.keys(overlay)) {
        const hash = known?.entries[collection]?.[id]

        recorded[id] = hash !== undefined ? hash : await hashes.entry(collection, id) ?? null
      }

      next.entries[collection] = recorded
    }

    changes.hashes = next
  }

  async function mutate(apply: (changes: Changes) => void): Promise<void> {
    const changes = await ready()

    apply(changes)
    notify()

    await track(changes)
    await store.write(changes)
  }

  return {
    content: createContentChanges(base, ready, mutate),
    media: createMediaChanges(media, previews, ready, mutate),

    summary: async () => {
      const changes = await ready()

      return {
        written: refs(changes, true),
        discarded: refs(changes, false),
        uploaded: Object.keys(changes.uploads),
        deleted: [...changes.removed],
      } satisfies ChangeSummary
    },

    files: async target => toFiles(await ready(), target),

    diff: async target => diffChanges(await ready(), base, media, previews, target),

    resolve: async (conflicts, target, keep) => {
      const current = new Map(conflicts.map(conflict => [conflict.path, conflict.hash]))

      await mutate((changes) => {
        const recorded = changes.hashes ??= { entries: {} }

        for (const { path, collection, id } of changedEntries(changes, target)) {
          const hash = current.get(path)

          if (hash === undefined)
            continue

          if (keep === 'mine')
            recorded.entries[collection] = { ...recorded.entries[collection], [id]: hash }
          else
            delete changes.entries[collection]![id]
        }
      })
    },

    published: async () => {
      const changes = await ready()
      const removed = new Set(changes.removed)
      const kept: Record<string, PendingUpload> = {}

      for (const upload of [...publishedUploads(changes), ...Object.values(changes.uploads)]) {
        if (!removed.has(upload.name))
          kept[upload.name] = upload
      }

      const next: Changes = { ...empty(), ...Object.keys(kept).length > 0 ? { publishedMedia: kept } : {} }

      loaded = Promise.resolve(next)
      notify()

      await (next.publishedMedia ? store.write(next) : store.clear())
    },

    discard: async () => {
      const { publishedMedia } = await ready()
      const next: Changes = { ...empty(), ...publishedMedia ? { publishedMedia } : {} }

      previews.clear()
      loaded = Promise.resolve(next)
      notify()

      await (publishedMedia ? store.write(next) : store.clear())
    },

    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}
