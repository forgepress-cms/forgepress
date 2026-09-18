import type { Entry, EntryRef } from '../entries/types'
import type { HashSource } from '../forge/types'
import type { MediaSource } from '../media/types'
import type { ContentSource, KeyValueStore } from '../store/types'
import type { ChangeHashes, Changes, ChangeService, ChangeSummary, LeftOut } from './types'
import { validateEntry } from '../entries/validate'
import { ContentError } from '../files/issues'
import { parseFile } from '../files/parse'
import { once } from '../utils/once'
import { isRecord, same } from '../utils/value'
import { createContentChanges } from './content'
import { diffChanges } from './diff'
import { stage } from './entries'
import { changedEntries, toFiles } from './files'
import { createMediaChanges, localUploads } from './media'
import { createPreviews } from './previews'
import { adaptEntry } from './rebase'

function entryOf(text: string, id: string): Entry | undefined {
  const parsed = parseFile({ path: id, text })

  return 'value' in parsed && isRecord(parsed.value) ? parsed.value as Entry : undefined
}

function unparsed(error: unknown): undefined {
  if (error instanceof ContentError)
    return undefined

  throw error
}

export function emptyChanges(): Changes {
  return { entries: {}, uploads: {}, removed: [] }
}

export async function readChanges(store: KeyValueStore<Changes>): Promise<Changes> {
  return { ...emptyChanges(), ...await store.read() }
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

  let loaded = once(() => readChanges(store))

  function notify(): void {
    for (const listener of listeners)
      listener()
  }

  function ready(): Promise<Changes> {
    return loaded()
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

    adapt: async (read) => {
      if (!hashes)
        return []

      const changes = await ready()
      const schema = await base.schema()
      const left: LeftOut[] = []
      const adapted: { collection: string, id: string, entry: Entry, head: Entry | undefined, hash: string | null }[] = []

      for (const [collection, overlay] of Object.entries(changes.entries)) {
        for (const [id, row] of Object.entries(overlay)) {
          const recorded = changes.hashes?.entries[collection]?.[id]
          const current = await hashes.entry(collection, id) ?? null
          const moved = recorded !== undefined && recorded !== current

          if (row === null || (moved && (recorded === null || current === null)) || (!moved && validateEntry(schema, collection, row).length === 0))
            continue

          const original = moved ? entryOf(await read(recorded!), id) : await base.entry(collection, id).catch(unparsed)
          const head = moved ? entryOf(await read(current!), id) : original

          if (moved && (!original || !head))
            continue

          const result = adaptEntry(row, schema, collection, original, head)

          if (result.conflicts.length > 0 || (!moved && same(result.entry, row)))
            continue

          adapted.push({ collection, id, entry: result.entry, head, hash: current })
          left.push(...result.dropped.map(field => ({ collection, id, field, value: row[field] })))
        }
      }

      if (adapted.length > 0) {
        await mutate((changes) => {
          const recorded = changes.hashes ??= { entries: {} }

          for (const { collection, id, entry, head, hash } of adapted) {
            recorded.entries[collection] = { ...recorded.entries[collection], [id]: hash }
            stage(changes.entries[collection] ??= {}, head, entry)
          }
        })
      }

      return left
    },

    published: async () => {
      const kept = Object.fromEntries(localUploads(await ready()).map(upload => [upload.name, upload]))
      const next: Changes = { ...emptyChanges(), ...Object.keys(kept).length > 0 ? { publishedMedia: kept } : {} }

      loaded = async () => next
      notify()

      await (next.publishedMedia ? store.write(next) : store.clear())
    },

    discard: async () => {
      const { publishedMedia } = await ready()
      const next: Changes = { ...emptyChanges(), ...publishedMedia ? { publishedMedia } : {} }

      previews.clear()
      loaded = async () => next
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
