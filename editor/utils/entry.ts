import type { CollectionEntry } from '../../src/entries/references'
import type { Entry, EntryStatus } from '../../src/entries/types'
import type { Collection, Component } from '../../src/schema/types'
import type { ComponentForm, FormField, LocalizedField } from './schema'
import { entryId } from '../../src/entries/id'
import { entryKey } from '../../src/entries/references'
import { itemComponent } from '../../src/schema/fields/component'
import { onlyName } from '../../src/schema/fields/picked'
import { asList, filled, isRecord } from '../../src/utils/value'
import { markdownLines } from './markdown'
import { chips, localized } from './preview'
import { toFields } from './schema'

export const SINGLE = ''

export const NESTED_DEPTH = 3

export type StatusColor = 'neutral' | 'success' | 'warning'

const STATUS_LABELS: Record<EntryStatus, string> = {
  unpublished: 'Unpublished',
  published: 'Published',
}

const STATUS_COLORS: Record<EntryStatus, StatusColor> = {
  unpublished: 'warning',
  published: 'success',
}

export const STATUSES = Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value: value as EntryStatus }))

export type EntryValues = Record<string, Record<string, any>>

export function statusColor(status: unknown): StatusColor {
  return STATUS_COLORS[status as EntryStatus] ?? 'neutral'
}

export function statusLabel(status: unknown): string {
  return STATUS_LABELS[status as EntryStatus] ?? String(status)
}

export function localeItems(locales: readonly string[]): { label: string, value: string }[] {
  return locales.map(value => ({ label: value.toUpperCase(), value }))
}

export function newEntry(collection: string): Entry {
  const now = new Date().toISOString()

  return { id: entryId(collection), status: 'unpublished', createdAt: now, updatedAt: now }
}

export function condense(value: string): string {
  const line = markdownLines(value)[0] ?? ''

  return line.length > 80 ? `${line.slice(0, 80)}…` : line
}

export function entryLabel(row: Entry, field: FormField | undefined, locale?: string): string {
  const value = field && chips(localized(row[field.key], field.translated ? locale : undefined))[0]

  return (value && condense(value)) || String(row.id)
}

export function titleField<TField extends FormField>(fields: TField[]): TField | undefined {
  return fields.find(field => field.type === 'text')
    ?? fields.find(field => field.type === 'richtext')
}

export function fieldLocale(field: FormField, locales: readonly string[]): string {
  return field.translated ? locales[0] ?? SINGLE : SINGLE
}

export function toLocalizedFields(collection: Collection, locales: readonly string[], components: Readonly<Record<string, Component>> = {}): LocalizedField[] {
  return toFields(collection, locales, components).map(field => ({ ...field, locale: fieldLocale(field, locales) }))
}

export function empty(field: FormField): unknown {
  const config = field.config

  if (config.type === 'component')
    return config.multiple ? [] : null

  if (config.type === 'number')
    return null

  if (config.type === 'boolean')
    return config.default ?? false

  if (config.type === 'list')
    return config.multiple ? [] : ''

  if (config.type === 'collection')
    return config.multiple ? [] : onlyName(config.collections) === undefined ? null : ''

  if (config.type === 'image' || config.type === 'video')
    return config.multiple ? [] : null

  return ''
}

export function toValues(fields: FormField[], row: Entry, locales: readonly string[]): EntryValues {
  return Object.fromEntries(fields.map((field) => {
    const current = row[field.key]

    if (!field.translated)
      return [field.key, { [SINGLE]: current ?? empty(field) }]

    const translations = isRecord(current) ? current : {}

    return [field.key, Object.fromEntries(locales.map(locale => [locale, translations[locale] ?? empty(field)]))]
  }))
}

export function fromValues(field: FormField, values: EntryValues): unknown {
  const value = values[field.key]!

  if (!field.translated)
    return filled(value[SINGLE]) ? value[SINGLE] : undefined

  const translations = Object.entries(value).filter(([, item]) => filled(item))

  return translations.length ? Object.fromEntries(translations) : undefined
}

export function toRow(fields: readonly FormField[], values: EntryValues, row: Entry): Entry {
  const next: Entry = { ...row }

  for (const field of fields) {
    const value = fromValues(field, values)

    if (value === undefined)
      delete next[field.key]
    else
      next[field.key] = value
  }

  return next
}

export function picked(value: unknown): string[] {
  return asList(value).filter(item => typeof item === 'string')
}

export function itemValues(fields: readonly FormField[], item: unknown, locales: readonly string[] = []): EntryValues {
  return toValues([...fields], (isRecord(item) ? item : {}) as Entry, locales)
}

export function fromItem(fields: readonly FormField[], values: EntryValues): Record<string, unknown> {
  return Object.fromEntries(fields.flatMap((field) => {
    const value = fromValues(field, values)

    return value === undefined ? [] : [[field.key, value]]
  }))
}

function itemsOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]
}

export function componentForm(field: FormField, item: unknown): ComponentForm | undefined {
  if (field.config.type !== 'component')
    return undefined

  const name = itemComponent(field.config, item)

  return field.components?.find(form => form.name === name)
}

function incomplete(field: FormField, value: unknown, locales: readonly string[]): boolean {
  if (!filled(value))
    return !field.optional

  return itemsOf(value).some((item) => {
    const form = componentForm(field, item)

    return form !== undefined && missingFields(form.fields, itemValues(form.fields, item, locales), locales).length > 0
  })
}

export function missingFields<TField extends FormField>(fields: TField[], values: EntryValues, locales: readonly string[] = []): TField[] {
  return fields.filter((field) => {
    const value = values[field.key]!

    return field.translated
      ? Object.values(value).some(translation => incomplete(field, translation, locales))
      : incomplete(field, value[SINGLE], locales)
  })
}

export function withPublished(entries: readonly CollectionEntry[], linked: readonly CollectionEntry[], updatedAt: string): CollectionEntry[] {
  const key = (item: CollectionEntry): string => entryKey(item.collection, item.entry.id)
  const publishing = new Set(linked.map(key))
  const writing = new Set(entries.map(key))
  const publish = (item: CollectionEntry): CollectionEntry => ({ collection: item.collection, entry: { ...item.entry, status: 'published', updatedAt } })

  return [
    ...linked.filter(item => !writing.has(key(item))).map(publish),
    ...entries.map(item => publishing.has(key(item)) ? publish(item) : item),
  ]
}
