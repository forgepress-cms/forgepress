import type { ContentRow, EntryRef } from '../../types/entry'
import type { StatusColor } from '../utils/entry'
import { entryKey, entryReferences } from '../../entries/references'
import { entryLabel, statusColor, titleField } from '../utils/entry'
import { toFields } from '../utils/schema'
import { useContent } from './useContent'

export interface EntryOption {
  label: string
  value: string
  chip: { color: StatusColor }
}

export interface Entries {
  options: (collection: string) => EntryOption[]
  label: (collection: string, id: unknown) => string
  collectionLabel: (collection: string) => string
  row: (collection: string, id: string) => ContentRow | undefined
  usedBy: (collection: string, id: string) => EntryRef[]
}

export async function useEntries(): Promise<Entries> {
  const { store } = useContent()
  const schema = await store.schema()
  const locales = schema.locales ?? []

  const loaded = await Promise.all(Object.entries(schema.collections).map(async ([name, collection]) => ({
    name,
    rows: await store.list(name),
    title: titleField(toFields(collection, locales)),
  })))

  const index = new Map(loaded.map(({ name, rows, title }) => [name, rows.map(row => ({
    value: String(row.id),
    label: entryLabel(row, title, locales[0]),
    chip: { color: statusColor(row.status) },
  }))]))

  const rows = new Map(loaded.map(({ name, rows }) => [name, new Map(rows.map(row => [String(row.id), row]))]))
  const usage = new Map<string, Map<string, EntryRef>>()

  for (const { name, rows } of loaded) {
    for (const row of rows) {
      const source = { collection: name, id: String(row.id) }

      for (const target of entryReferences(schema, name, row)) {
        const key = entryKey(target.collection, target.id)
        const users = usage.get(key) ?? new Map<string, EntryRef>()

        users.set(entryKey(source.collection, source.id), source)
        usage.set(key, users)
      }
    }
  }

  return {
    options: collection => index.get(collection) ?? [],
    label: (collection, id) => index.get(collection)?.find(option => option.value === id)?.label ?? String(id ?? ''),
    collectionLabel: collection => schema.collections[collection]?.label ?? collection,
    row: (collection, id) => rows.get(collection)?.get(id),
    usedBy: (collection, id) => [...usage.get(entryKey(collection, id))?.values() ?? []],
  }
}
