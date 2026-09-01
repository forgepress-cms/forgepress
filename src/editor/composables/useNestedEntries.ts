import type { ContentRow } from '../../types/content/reader'
import type { EntryValues } from '../utils/entry'
import type { Field } from '../utils/schema'
import { reactive } from 'vue'
import { source } from '../../content/source'
import { fieldLocale, fromValues, missingFields, newEntry, toValues } from '../utils/entry'
import { toFields } from '../utils/schema'

export interface NestedField extends Field {
  locale: string
}

export interface NestedDraft {
  id: string
  component: string
  row: ContentRow
  fields: NestedField[]
  values: EntryValues
}

export interface NestedEntries {
  drafts: Record<string, NestedDraft>
  create: (component: string) => string
  discard: (id: string) => void
  clear: () => void
  missing: () => string[]
  rows: () => Record<string, ContentRow[]>
}

export async function useNestedEntries(): Promise<NestedEntries> {
  const schema = await source.schema()
  const locales = schema.locales ?? []

  const drafts = reactive<Record<string, NestedDraft>>({})

  function create(component: string): string {
    const row = newEntry(component)
    const fields = toFields(schema.components[component] ?? { elements: {} }, locales)
      .map(field => ({ ...field, locale: fieldLocale(field, locales) }))

    drafts[row.id] = {
      id: row.id,
      component,
      row,
      fields,
      values: toValues(fields, row, locales),
    }

    return row.id
  }

  function discard(id: string): void {
    delete drafts[id]
  }

  function draft(entry: NestedDraft): ContentRow {
    const next: ContentRow = { ...entry.row }

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
      missingFields(entry.fields, entry.values).map(field => `${field.label} of the new ${entry.component}`),
    ),

    rows: () => Object.values(drafts).reduce<Record<string, ContentRow[]>>((created, entry) => {
      created[entry.component] = [...created[entry.component] ?? [], draft(entry)]

      return created
    }, {}),
  }
}
