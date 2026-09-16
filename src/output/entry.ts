import type { Entry } from '../entries/types'
import type { Field } from '../schema/fields'
import type { ForgePressSchema } from '../schema/types'
import type { LinkKind, OutputEntry } from './types'
import { OUTPUT_META_KEYS } from '../entries/meta'
import { isTranslated } from '../schema/fields'
import { isRecord, pick } from '../utils/value'

function fieldsOf(schema: ForgePressSchema, collection: string): [string, Field][] {
  return Object.entries(schema.collections[collection]?.fields ?? {})
}

function translation(stored: unknown, locale: string | undefined): unknown {
  return locale !== undefined && isRecord(stored) ? stored[locale] : undefined
}

function linked(field: Field, value: unknown): unknown {
  if (field.type !== 'relation')
    return value

  const link = (id: unknown): unknown => ({ collection: field.collection, id })

  return Array.isArray(value) ? value.map(link) : link(value)
}

export function isLocalized(schema: ForgePressSchema, collection: string): boolean {
  return fieldsOf(schema, collection).some(([, field]) => isTranslated(field, schema.locales ?? []))
}

export function indexedFields(schema: ForgePressSchema, collection: string): string[] {
  return fieldsOf(schema, collection).filter(([, field]) => 'index' in field && field.index === true).map(([key]) => key)
}

export function linkFields(schema: ForgePressSchema, collection: string): Record<string, LinkKind> {
  return Object.fromEntries(fieldsOf(schema, collection).flatMap(([key, field]) => field.type === 'relation' || field.type === 'dynamic' ? [[key, field.type]] : []))
}

export function toOutputEntry(schema: ForgePressSchema, collection: string, entry: Entry, locale?: string): OutputEntry {
  const locales = schema.locales ?? []
  const output = pick(entry, OUTPUT_META_KEYS) as OutputEntry

  for (const [key, field] of fieldsOf(schema, collection)) {
    const value = isTranslated(field, locales) ? translation(entry[key], locale) : entry[key]

    if (value !== undefined)
      output[key] = linked(field, value)
  }

  return output
}
