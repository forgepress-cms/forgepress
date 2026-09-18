import type { Collection, ForgePressSchema } from '../schema/types'
import { defaultLocale } from '../schema/locales'

export interface SchemaDraft {
  collections: Record<string, Collection>
  locales?: readonly string[]
  defaultLocale?: string
}

export interface Link {
  collection: string
  field: string
}

export function renameKey<TValue>(record: Readonly<Record<string, TValue>>, from: string, to: string): Record<string, TValue> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key === from ? to : key, value]))
}

export function linksTo(schema: ForgePressSchema, name: string): Link[] {
  return Object.entries(schema.collections).filter(([collection]) => collection !== name).flatMap(([collection, definition]) =>
    Object.entries(definition.fields)
      .filter(([, field]) => (field.type === 'relation' && field.collection === name) || (field.type === 'dynamic' && field.collections.includes(name)))
      .map(([field]) => ({ collection, field })))
}

export function renameCollection(draft: SchemaDraft, from: string, to: string): void {
  draft.collections = renameKey(draft.collections, from, to)

  for (const collection of Object.values(draft.collections)) {
    for (const field of Object.values(collection.fields)) {
      if (field.type === 'relation' && field.collection === from)
        field.collection = to
      else if (field.type === 'dynamic')
        field.collections = field.collections.map(name => name === from ? to : name)
    }
  }
}

export function removeCollection(draft: SchemaDraft, name: string): void {
  delete draft.collections[name]

  for (const collection of Object.values(draft.collections)) {
    for (const [key, field] of Object.entries(collection.fields)) {
      if (field.type === 'relation' && field.collection === name)
        delete collection.fields[key]
      else if (field.type === 'dynamic' && field.collections.includes(name))
        field.collections = field.collections.filter(item => item !== name)
    }
  }
}

export function renameField(draft: SchemaDraft, collection: string, from: string, to: string): void {
  const definition = draft.collections[collection]

  if (definition)
    definition.fields = renameKey(definition.fields, from, to)
}

export function setDefaultLocale(draft: SchemaDraft, locale: string): void {
  if ((draft.locales ?? []).length < 2)
    delete draft.defaultLocale
  else
    draft.defaultLocale = locale
}

export function renameLocale(draft: SchemaDraft, from: string, to: string): void {
  draft.locales = (draft.locales ?? []).map(locale => locale === from ? to : locale)

  if (draft.defaultLocale === from)
    draft.defaultLocale = to
}

export function removeLocale(draft: SchemaDraft, locale: string): void {
  const locales = (draft.locales ?? []).filter(item => item !== locale)

  if (locales.length > 0) {
    const chosen = defaultLocale(draft)

    draft.locales = locales
    setDefaultLocale(draft, chosen === locale ? locales[0]! : chosen!)

    return
  }

  delete draft.locales
  delete draft.defaultLocale

  for (const collection of Object.values(draft.collections)) {
    for (const field of Object.values(collection.fields))
      delete field.translate
  }
}
