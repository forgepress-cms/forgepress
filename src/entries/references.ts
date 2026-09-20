import type { ValueIssue, ValuePath } from '../files/issues'
import type { Field } from '../schema/fields'
import type { CollectionField } from '../schema/fields/collection'
import type { ComponentField } from '../schema/fields/component'
import type { Component, ForgePressSchema } from '../schema/types'
import type { Entry, EntryRef } from './types'
import { isTranslated } from '../schema/fields'
import { itemComponent } from '../schema/fields/component'
import { items, onlyName } from '../schema/fields/picked'
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

type Components = Readonly<Record<string, Component>>

function itemReferences(field: ComponentField, item: unknown, path: ValuePath, components: Components, locales: readonly string[]): Reference[] {
  if (!isRecord(item))
    return []

  const name = itemComponent(field, item)
  const fields = name === undefined ? {} : components[name]?.fields ?? {}

  return Object.entries(fields).flatMap(([key, inner]) => localized(item[key], [...path, key], isTranslated(inner, locales))
    .flatMap(([at, value]) => references(inner, value, at, components, locales)))
}

function entryReference(field: CollectionField, value: unknown, path: ValuePath): Reference[] {
  const only = onlyName(field.collections)

  if (only !== undefined)
    return typeof value === 'string' ? [{ path, collection: only, id: value }] : []

  return isEntryRef(value) && field.collections.includes(value.collection)
    ? [{ path, collection: value.collection, id: value.id }]
    : []
}

function references(field: Field, value: unknown, path: ValuePath, components: Components, locales: readonly string[]): Reference[] {
  if (field.type !== 'component' && field.type !== 'collection')
    return []

  const item = (entry: unknown, at: ValuePath): Reference[] => field.type === 'component'
    ? itemReferences(field, entry, at, components, locales)
    : entryReference(field, entry, at)

  return items(value, field.multiple).flatMap((entry, index) => item(entry, field.multiple ? [...path, index] : path))
}

export function entryReferences(schema: ForgePressSchema, collection: string, row: Entry): Reference[] {
  const locales = schema.locales ?? []

  return Object.entries(schema.collections[collection]?.fields ?? {}).flatMap(([key, field]) =>
    localized(row[key], [key], isTranslated(field, locales))
      .flatMap(([path, value]) => references(field, value, path, schema.components ?? {}, locales)))
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
