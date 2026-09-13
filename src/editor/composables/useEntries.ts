import type { ContentRow } from '../../types/content/reader'
import type { FormField } from '../utils/schema'
import { entryLabel, statusColor, titleField } from '../utils/entry'
import { toFields } from '../utils/schema'
import { useContent } from './useContent'

export interface EntryOption {
  label: string
  value: string
  chip: { color: 'neutral' | 'success' | 'warning' }
}

export interface Entries {
  options: (collection: string) => EntryOption[]
  label: (collection: string, id: unknown) => string
  collectionLabel: (collection: string) => string
  fields: (collection: string) => FormField[]
}

export async function useEntries(): Promise<Entries> {
  const { store } = useContent()
  const schema = await store.schema()
  const locales = schema.locales ?? []

  const loaded = await Promise.all(Object.entries(schema.collections).map(async ([name, collection]) => {
    const title = titleField(toFields(collection, locales))
    const rows: ContentRow[] = await store.list(name)

    return [name, rows.map(row => ({
      value: String(row.id),
      label: entryLabel(row, title, locales[0]),
      chip: { color: statusColor(row.status) },
    }))] as const
  }))

  const index = new Map(loaded)

  return {
    options: collection => index.get(collection) ?? [],
    label: (collection, id) => index.get(collection)?.find(option => option.value === id)?.label ?? String(id ?? ''),
    collectionLabel: collection => schema.collections[collection]?.label ?? collection,
    fields: (collection) => {
      const found = schema.collections[collection]

      return found ? toFields(found, locales) : []
    },
  }
}
