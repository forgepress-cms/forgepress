import type { Field } from '../schema/fields'
import type { ContentRow, EntryRef } from '../types/entry'
import type { ValueIssue, ValuePath } from '../types/issues'
import type { ForgePressSchema } from '../types/schema'
import { isRecord, quote } from '../utils/value'

export interface EntryIssue extends ValueIssue {
  collection: string
  id: string
}

export type ContentEntries = Readonly<Record<string, Readonly<Record<string, ContentRow>>>>

export interface Reference extends EntryRef {
  path: ValuePath
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
    return value.flatMap((block, index) => isRecord(block) && typeof block.id === 'string' && typeof block.collection === 'string' && field.collections.includes(block.collection)
      ? [{ path: [...path, index], collection: block.collection, id: block.id }]
      : [])
  }

  return []
}

export function entryReferences(schema: ForgePressSchema, collection: string, row: ContentRow): Reference[] {
  const translatable = (schema.locales ?? []).length > 0

  return Object.entries(schema.collections[collection]?.fields ?? {}).flatMap(([key, field]) =>
    localized(row[key], [key], translatable && field.translate === true)
      .flatMap(([path, value]) => references(field, value, path)))
}

export function validateReferences(schema: ForgePressSchema, content: ContentEntries): EntryIssue[] {
  const issues: EntryIssue[] = []

  for (const [collection, entries] of Object.entries(content)) {
    for (const [id, row] of Object.entries(entries)) {
      for (const reference of entryReferences(schema, collection, row)) {
        const target = content[reference.collection]?.[reference.id]
        const name = `${reference.collection}/${reference.id}`
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
