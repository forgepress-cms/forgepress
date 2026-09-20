import type { Field } from '../schema/fields'
import type { Collection, Component, ForgePressSchema } from '../schema/types'
import { defaultLocale } from '../schema/locales'

export interface SchemaDraft {
  components?: Record<string, Component>
  collections: Record<string, Collection>
  locales?: readonly string[]
  defaultLocale?: string
}

export type Group = 'collections' | 'components'

export interface Usage {
  kind: 'collection' | 'component'
  holder: string
  field: string
}

export function pickedNames(field: Field, group: Group): readonly string[] | undefined {
  if (group === 'collections')
    return field.type === 'collection' ? field.collections : undefined

  return field.type === 'component' ? field.components : undefined
}

function repick(field: Field, group: Group, names: string[]): void {
  if (field.type === 'collection' && group === 'collections')
    field.collections = names
  else if (field.type === 'component' && group === 'components')
    field.components = names
}

export function renameKey<TValue>(record: Readonly<Record<string, TValue>>, from: string, to: string): Record<string, TValue> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key === from ? to : key, value]))
}

function fieldsOf(draft: SchemaDraft): [Collection, string, Field][] {
  return holders(draft).flatMap(holder => Object.entries(holder.fields).map(([key, field]) => [holder, key, field] as [Collection, string, Field]))
}

function holders(draft: SchemaDraft): Collection[] {
  return [...Object.values(draft.components ?? {}), ...Object.values(draft.collections)]
}

function renamePick(draft: SchemaDraft, group: Group, from: string, to: string): void {
  for (const [, , field] of fieldsOf(draft)) {
    const names = pickedNames(field, group)

    if (names?.includes(from))
      repick(field, group, names.map(name => name === from ? to : name))
  }
}

function removePick(draft: SchemaDraft, group: Group, name: string): void {
  for (const [holder, key, field] of fieldsOf(draft)) {
    const names = pickedNames(field, group)

    if (!names?.includes(name))
      continue

    const kept = names.filter(item => item !== name)

    if (kept.length > 0)
      repick(field, group, kept)
    else
      delete holder.fields[key]
  }
}

export function uses(schema: ForgePressSchema, group: Group, name: string): Usage[] {
  const groups = [['component', schema.components ?? {}], ['collection', schema.collections]] as const

  return groups.flatMap(([kind, holders]) => Object.entries(holders).flatMap(([holder, definition]) => Object.entries(definition.fields)
    .filter(([, field]) => holder !== name && pickedNames(field, group)?.includes(name))
    .map(([field]) => ({ kind, holder, field }))))
}

export function renameCollection(draft: SchemaDraft, from: string, to: string): void {
  draft.collections = renameKey(draft.collections, from, to)
  renamePick(draft, 'collections', from, to)
}

export function removeCollection(draft: SchemaDraft, name: string): void {
  delete draft.collections[name]
  removePick(draft, 'collections', name)
}

export function renameField(draft: SchemaDraft, collection: string, from: string, to: string): void {
  const definition = draft.collections[collection]

  if (definition)
    definition.fields = renameKey(definition.fields, from, to)
}

export function renameComponent(draft: SchemaDraft, from: string, to: string): void {
  draft.components = renameKey(draft.components ?? {}, from, to)
  renamePick(draft, 'components', from, to)
}

export function removeComponent(draft: SchemaDraft, name: string): void {
  delete draft.components?.[name]
  removePick(draft, 'components', name)
}

export function renameComponentField(draft: SchemaDraft, component: string, from: string, to: string): void {
  const definition = draft.components?.[component]

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
