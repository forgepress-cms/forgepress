import type { Field } from '../schema/fields'
import type { Entry } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import type { OutputEntry } from './types'
import { isRecord } from '../utils/value'

function fieldsOf(schema: ForgePressSchema, collection: string): [string, Field][] {
  return Object.entries(schema.collections[collection]?.fields ?? {})
}

function localized(field: Field, stored: unknown, locale: string | undefined): unknown {
  if (field.translate !== true)
    return stored

  return locale !== undefined && isRecord(stored) ? stored[locale] : undefined
}

function linked(field: Field, value: unknown): unknown {
  if (field.type !== 'relation')
    return value

  const link = (id: unknown): unknown => ({ collection: field.collection, id })

  return Array.isArray(value) ? value.map(link) : link(value)
}

export function isLocalized(schema: ForgePressSchema, collection: string): boolean {
  return (schema.locales ?? []).length > 0 && fieldsOf(schema, collection).some(([, field]) => field.translate === true)
}

export function indexedFields(schema: ForgePressSchema, collection: string): string[] {
  return fieldsOf(schema, collection).filter(([, field]) => 'index' in field && field.index === true).map(([key]) => key)
}

export function toOutputEntry(schema: ForgePressSchema, collection: string, entry: Entry, locale?: string): OutputEntry {
  const output: OutputEntry = { id: entry.id, createdAt: entry.createdAt, updatedAt: entry.updatedAt }

  for (const [key, field] of fieldsOf(schema, collection)) {
    const value = localized(field, entry[key], locale)

    if (value !== undefined)
      output[key] = linked(field, value)
  }

  return output
}
