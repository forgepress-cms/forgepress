import type { ContentRow } from '../../types/content/reader'
import type { FormField } from './schema'
import { filled } from '../../content/value'
import { markdownLines } from './markdown'
import { chips, localized } from './preview'

export { filled }

export const SINGLE = ''

export const STATUSES = [
  { label: 'Unpublished', value: 'unpublished' },
  { label: 'Published', value: 'published' },
]

const STATUS_COLORS: Record<string, 'neutral' | 'success' | 'warning'> = {
  unpublished: 'warning',
  published: 'success',
}

export type EntryValues = Record<string, Record<string, any>>

export function statusColor(status: unknown): 'neutral' | 'success' | 'warning' {
  return STATUS_COLORS[String(status)] ?? 'neutral'
}

export function localeItems(locales: readonly string[]): { label: string, value: string }[] {
  return locales.map(value => ({ label: value.toUpperCase(), value }))
}

export function entryId(collection: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))

  return `${collection}_${[...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export function newEntry(collection: string): ContentRow {
  const now = new Date().toISOString()

  return { id: entryId(collection), status: 'unpublished', createdAt: now, updatedAt: now }
}

export function condense(value: string): string {
  const line = markdownLines(value)[0] ?? ''

  return line.length > 80 ? `${line.slice(0, 80)}…` : line
}

export function entryLabel(row: ContentRow, field: FormField | undefined, locale?: string): string {
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

export function toValues(fields: FormField[], row: ContentRow, locales: readonly string[]): EntryValues {
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
