import type { ContentRow, EntryStatus } from '../../types/entry'
import type { EntryValues } from '../utils/entry'
import type { FormField } from '../utils/schema'
import { reactive } from 'vue'
import { fieldLocale, fromValues, missingFields, newEntry, toValues } from '../utils/entry'
import { toFields } from '../utils/schema'
import { useContent } from './useContent'

export interface NestedField extends FormField {
  locale: string
}

export interface NestedDraft {
  id: string
  collection: string
  row: ContentRow
  fields: NestedField[]
  values: EntryValues
}

export interface NestedEntries {
  drafts: Record<string, NestedDraft>
  create: (collection: string) => string
  discard: (id: string) => void
  clear: () => void
  missing: () => string[]
  rows: (status: EntryStatus) => Record<string, ContentRow[]>
}

export async function useNestedEntries(): Promise<NestedEntries> {
  const { store } = useContent()
  const schema = await store.schema()
  const locales = schema.locales ?? []

  const drafts = reactive<Record<string, NestedDraft>>({})

  function create(collection: string): string {
    const row = newEntry(collection)
    const fields = toFields(schema.collections[collection] ?? { fields: {} }, locales)
      .map(field => ({ ...field, locale: fieldLocale(field, locales) }))

    drafts[row.id] = {
      id: row.id,
      collection,
      row,
      fields,
      values: toValues(fields, row, locales),
    }

    return row.id
  }

  function discard(id: string): void {
    delete drafts[id]
  }

  function draft(entry: NestedDraft, status: EntryStatus): ContentRow {
    const next: ContentRow = { ...entry.row, status }

    for (const field of entry.fields) {
      const value = fromValues(field, entry.values)

      if (value !== undefined)
        next[field.key] = value
    }

    return next
  }

  return {
    drafts,

    create,
    discard,

    clear: () => {
      for (const id of Object.keys(drafts))
        delete drafts[id]
    },

    missing: () => Object.values(drafts).flatMap(entry =>
      missingFields(entry.fields, entry.values).map(field => `${field.label} of the new ${entry.collection}`),
    ),

    rows: status => Object.values(drafts).reduce<Record<string, ContentRow[]>>((created, entry) => {
      created[entry.collection] = [...created[entry.collection] ?? [], draft(entry, status)]

      return created
    }, {}),
  }
}
