import type { ContentSource } from '../../types/content/reader'
import type { ChangeSet, ChangeStore, KeyValueStore, StoredChanges } from '../../types/content/store'
import type { ContentWriter } from '../../types/content/writer'

function plain<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue
}

function empty(): StoredChanges {
  return { components: {} }
}

export function createMemoryStore<TValue = StoredChanges>(): KeyValueStore<TValue> {
  let value: TValue | undefined

  return {
    read: async () => value,
    write: async (next) => {
      value = next
    },
    clear: async () => {
      value = undefined
    },
  }
}

export function createChangeSet(base: ContentSource, store: ChangeStore): ChangeSet {
  let loaded: Promise<StoredChanges> | undefined

  function ready(): Promise<StoredChanges> {
    loaded ??= store.read().then(changes => changes ?? empty())

    return loaded
  }

  async function mutate(apply: (changes: StoredChanges) => void): Promise<void> {
    const changes = await ready()

    apply(changes)

    delete changes.published

    await store.write(changes)
  }

  async function reset(): Promise<void> {
    loaded = Promise.resolve(empty())

    await store.clear()
  }

  return {
    schema: async () => (await ready()).schema ?? await base.schema(),

    list: async (component) => {
      const pending = (await ready()).components[component]

      if (pending === null)
        return []

      return pending ?? await base.list(component)
    },

    writeSchema: schema => mutate((changes) => {
      changes.schema = plain(schema)
    }),

    writeContent: (component, rows) => mutate((changes) => {
      changes.components[component] = plain(rows)
    }),

    removeContent: component => mutate((changes) => {
      changes.components[component] = null
    }),

    pending: async () => {
      const changes = await ready()
      const entries = Object.entries(changes.components)

      return {
        ...changes.published === undefined ? {} : { published: changes.published },
        schema: changes.schema !== undefined,
        written: entries.filter(([, rows]) => rows !== null).map(([component]) => component),
        removed: entries.filter(([, rows]) => rows === null).map(([component]) => component),
      }
    },

    snapshot: ready,

    published: async (commit) => {
      const changes = await ready()

      changes.published = commit

      await store.write(changes)
    },

    publish: async (writer: ContentWriter) => {
      const changes = await ready()

      if (changes.schema !== undefined)
        await writer.writeSchema(changes.schema)

      for (const [component, rows] of Object.entries(changes.components)) {
        if (rows === null)
          await writer.removeContent(component)
        else
          await writer.writeContent(component, rows)
      }

      await reset()
    },

    discard: reset,
  }
}
