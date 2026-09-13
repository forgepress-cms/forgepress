import type { Field } from '../../fields'
import type { ValueIssue, ValuePath } from '../../types/content/issues'
import type { ContentRow } from '../../types/content/reader'
import type { ForgePressSchema } from '../../types/core/schema'
import { quote } from '../issues'
import { isRecord } from '../value'

export interface EntryIssue extends ValueIssue {
  collection: string
  id: string
}

export type ContentEntries = Readonly<Record<string, Readonly<Record<string, ContentRow>>>>

interface Reference {
  path: ValuePath
  collection: string
  id: string
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

export function validateReferences(schema: ForgePressSchema, content: ContentEntries): EntryIssue[] {
  const issues: EntryIssue[] = []
  const translatable = (schema.locales ?? []).length > 0

  for (const [collection, entries] of Object.entries(content)) {
    const fields = Object.entries(schema.collections[collection]?.fields ?? {})

    for (const [id, row] of Object.entries(entries)) {
      for (const [key, field] of fields) {
        for (const [path, value] of localized(row[key], [key], translatable && field.translate === true)) {
          for (const reference of references(field, value, path)) {
            const target = content[reference.collection]?.[reference.id]
            const name = `${reference.collection}/${reference.id}`

            if (!target)
              issues.push({ collection, id, path: reference.path, message: `Field ${quote(key)} references ${name}, which doesn't exist` })
            else if (row.status === 'published' && target.status !== 'published')
              issues.push({ collection, id, path: reference.path, message: `Field ${quote(key)} references ${name}, which is unpublished; publish it or remove the reference` })
          }
        }
      }
    }
  }

  return issues
}
