import type { Entry, EntryStatus } from '../../types/entry'
import type { EntryValues } from '../utils/entry'
import type { LocalizedField } from '../utils/schema'
import { reactive } from 'vue'
import { plain } from '../../utils/value'
import { entryLabel, missingFields, newEntry, titleField, toLocalizedFields, toRow, toValues } from '../utils/entry'
import { useContent } from './useContent'

export interface NestedDraft {
  id: string
  collection: string
  row: Entry
  fields: LocalizedField[]
  values: EntryValues
  linked: boolean
}

export interface NestedEntries {
  drafts: Record<string, NestedDraft>
  create: (collection: string, owner: string) => string
  open: (collection: string, row: Entry) => void
  copy: (id: string, owner: string) => string
  discard: (id: string) => void
  clear: () => void
  missing: () => string[]
  rows: (status: EntryStatus) => Record<string, Entry[]>
}

export async function useNestedEntries(): Promise<NestedEntries> {
  const { store } = useContent()
  const schema = await store.schema()
  const locales = schema.locales ?? []

  const drafts = reactive<Record<string, NestedDraft>>({})
  const owners = new Map<string, string>()
  const opened = new Map<string, string>()

  function add(collection: string, row: Entry, linked: boolean, values?: EntryValues): NestedDraft {
    const fields = toLocalizedFields(schema.collections[collection] ?? { fields: {} }, locales)

    drafts[row.id] = {
      id: row.id,
      collection,
      row,
      fields,
      values: values ?? toValues(fields, row, locales),
      linked,
    }

    return drafts[row.id]!
  }

  function build(entry: NestedDraft, status: EntryStatus): Entry {
    return toRow(entry.fields, entry.values, { ...entry.row, status })
  }

  function pending(entry: NestedDraft): boolean {
    return !entry.linked || JSON.stringify(build(entry, entry.row.status)) !== opened.get(entry.id)
  }

  function statusOf(id: string | undefined, fallback: EntryStatus): EntryStatus {
    if (id === undefined)
      return fallback

    const entry = drafts[id]

    return entry?.linked ? entry.row.status : statusOf(owners.get(id), fallback)
  }

  return {
    drafts,

    create: (collection, owner) => {
      const row = newEntry(collection)

      add(collection, row, false)
      owners.set(row.id, owner)

      return row.id
    },

    open: (collection, row) => {
      if (drafts[row.id])
        return

      opened.set(row.id, JSON.stringify(build(add(collection, row, true), row.status)))
    },

    copy: (id, owner) => {
      const source = drafts[id]!
      const row = newEntry(source.collection)

      add(source.collection, row, false, plain(source.values))
      owners.set(row.id, owner)

      return row.id
    },

    discard: (id) => {
      delete drafts[id]
      opened.delete(id)
    },

    clear: () => {
      for (const id of Object.keys(drafts))
        delete drafts[id]

      owners.clear()
      opened.clear()
    },

    missing: () => Object.values(drafts).filter(pending).flatMap(entry =>
      missingFields(entry.fields, entry.values).map(field => entry.linked
        ? `${field.label} of ${entryLabel(entry.row, titleField(entry.fields), locales[0])}`
        : `${field.label} of the new ${entry.collection}`),
    ),

    rows: status => Object.values(drafts).filter(pending).reduce<Record<string, Entry[]>>((written, entry) => {
      const next = build(entry, entry.linked ? entry.row.status : statusOf(owners.get(entry.id), status))

      written[entry.collection] = [...written[entry.collection] ?? [], next]

      return written
    }, {}),
  }
}
