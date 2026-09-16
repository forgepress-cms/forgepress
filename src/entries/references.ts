import type { ValueIssue, ValuePath } from '../files/issues'
import type { Field } from '../schema/fields'
import type { ForgePressSchema } from '../schema/types'
import type { Entry, EntryRef } from './types'
import { isTranslated } from '../schema/fields'
import { isRecord, quote } from '../utils/value'

export interface EntryIssue extends ValueIssue {
  collection: string
  id: string
}

export type ContentEntries = Readonly<Record<string, Readonly<Record<string, Entry>>>>

export interface Reference extends EntryRef {
  path: ValuePath
}

export interface CollectionEntry {
  collection: string
  entry: Entry
}

export function entryKey(collection: string, id: string): string {
  return `${collection}/${id}`
}

export function isEntryRef(value: unknown): value is EntryRef {
  return isRecord(value) && typeof value.collection === 'string' && typeof value.id === 'string'
}

function localized(value: unknown, path: ValuePath, translated: boolean): [ValuePath, unknown][] {
  if (!translated)
    return [[path, value]]

  return isRecord(value) ? Object.entries(value).map(([locale, item]) => [[...path, locale], item]) : []
}

function references(field: Field, value: unknown, path: ValuePath): Reference[] {
  if (field.type === 'relation' && !field.multiple)
    return typeof value === 'string' ? [{ path, collection: field.collection, id: value }] : []

  if (!Array.isArray(value))
    return []

  if (field.type === 'relation') {
    return value.flatMap((id, index) => typeof id === 'string'
      ? [{ path: [...path, index], collection: field.collection, id }]
      : [])
  }

  if (field.type === 'dynamic') {
    return value.flatMap((block, index) => isEntryRef(block) && field.collections.includes(block.collection)
      ? [{ path: [...path, index], collection: block.collection, id: block.id }]
      : [])
  }

  return []
}

export function entryReferences(schema: ForgePressSchema, collection: string, row: Entry): Reference[] {
  const locales = schema.locales ?? []

  return Object.entries(schema.collections[collection]?.fields ?? {}).flatMap(([key, field]) =>
    localized(row[key], [key], isTranslated(field, locales))
      .flatMap(([path, value]) => references(field, value, path)))
}

export function validateReferences(schema: ForgePressSchema, content: ContentEntries): EntryIssue[] {
  const issues: EntryIssue[] = []

  for (const [collection, entries] of Object.entries(content)) {
    for (const [id, row] of Object.entries(entries)) {
      for (const reference of entryReferences(schema, collection, row)) {
        const target = content[reference.collection]?.[reference.id]
        const name = entryKey(reference.collection, reference.id)
        const field = quote(reference.path[0])

        if (!target)
          issues.push({ collection, id, path: reference.path, message: `Field ${field} references ${name}, which doesn't exist` })
        else if (row.status === 'published' && target.status !== 'published')
          issues.push({ collection, id, path: reference.path, message: `Field ${field} references ${name}, which is unpublished; publish it or remove the reference` })
      }
    }
  }

  return issues
}

export function unpublishedReferences(schema: ForgePressSchema, entries: readonly CollectionEntry[], find: (collection: string, id: string) => Entry | undefined): CollectionEntry[] {
  const given = new Map(entries.map(item => [entryKey(item.collection, item.entry.id), item.entry]))
  const pending = entries.filter(item => item.entry.status === 'published')
  const seen = new Set(pending.map(item => entryKey(item.collection, item.entry.id)))
  const found: CollectionEntry[] = []

  for (const { collection, entry } of pending) {
    for (const reference of entryReferences(schema, collection, entry)) {
      const key = entryKey(reference.collection, reference.id)
      const target = given.get(key) ?? find(reference.collection, reference.id)

      if (seen.has(key) || !target || target.status === 'published')
        continue

      seen.add(key)
      found.push({ collection: reference.collection, entry: target })
      pending.push({ collection: reference.collection, entry: target })
    }
  }

  return found
}
