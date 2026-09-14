import type { CollectionEntry } from '../../entries/references'
import type { Entry, EntryStatus } from '../../types/entry'
import type { Collection } from '../../types/schema'
import type { FormField, LocalizedField } from './schema'
import { entryKey } from '../../entries/references'
import { toHex } from '../../utils/encoding'
import { filled } from '../../utils/value'
import { markdownLines } from './markdown'
import { chips, localized } from './preview'
import { toFields } from './schema'

export const SINGLE = ''

export type StatusColor = 'neutral' | 'success' | 'warning'

export const STATUSES: { label: string, value: EntryStatus }[] = [
  { label: 'Unpublished', value: 'unpublished' },
  { label: 'Published', value: 'published' },
]

const STATUS_COLORS: Record<string, StatusColor> = {
  unpublished: 'warning',
  published: 'success',
}

export type EntryValues = Record<string, Record<string, any>>

export function statusColor(status: unknown): StatusColor {
  return STATUS_COLORS[String(status)] ?? 'neutral'
}

export function statusLabel(status: unknown): string {
  return STATUSES.find(item => item.value === status)?.label ?? String(status)
}

export function localeItems(locales: readonly string[]): { label: string, value: string }[] {
  return locales.map(value => ({ label: value.toUpperCase(), value }))
}

export function entryId(collection: string): string {
  return `${collection}_${toHex(crypto.getRandomValues(new Uint8Array(6)))}`
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

export function toLocalizedFields(collection: Collection, locales: readonly string[]): LocalizedField[] {
  return toFields(collection, locales).map(field => ({ ...field, locale: fieldLocale(field, locales) }))
}

function empty(field: FormField): unknown {
  const config = field.config

  if (config.type === 'number')
    return null

  if (config.type === 'dynamic')
    return []

  if (config.type === 'relation')
    return config.multiple ? [] : ''

  if (config.type === 'image' || config.type === 'video')
    return config.multiple ? [] : null

  return ''
}

export function toValues(fields: FormField[], row: Entry, locales: readonly string[]): EntryValues {
  return Object.fromEntries(fields.map((field) => {
    const current = row[field.key]

    if (!field.translated)
      return [field.key, { [SINGLE]: current ?? empty(field) }]

    const translations = (typeof current === 'object' && current !== null ? current : {}) as Record<string, unknown>

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

export function missingFields<TField extends FormField>(fields: TField[], values: EntryValues): TField[] {
  return fields.filter((field) => {
    if (field.optional)
      return false

    const value = values[field.key]!

    return field.translated
      ? Object.values(value).some(translation => !filled(translation))
      : !filled(value[SINGLE])
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
