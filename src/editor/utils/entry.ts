import type { ContentRow } from '../../types/content/reader'
import type { Field } from './schema'
import { filled } from '../../content/value'
import { markdownLines } from './markdown'
import { chips, localized } from './preview'

export { filled }

export const SINGLE = ''

export const STATUSES = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

const STATUS_COLORS: Record<string, 'neutral' | 'success' | 'warning'> = {
  draft: 'warning',
  published: 'success',
  archived: 'neutral',
}

export type EntryValues = Record<string, Record<string, any>>

export function statusColor(status: unknown): 'neutral' | 'success' | 'warning' {
  return STATUS_COLORS[String(status)] ?? 'neutral'
}

export function localeItems(locales: readonly string[]): { label: string, value: string }[] {
  return locales.map(value => ({ label: value.toUpperCase(), value }))
}

export function entryId(component: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))

  return `${component}_${[...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export function newEntry(component: string): ContentRow {
  const now = new Date().toISOString()

  return { id: entryId(component), status: 'draft', createdAt: now, updatedAt: now }
}

export function condense(value: string): string {
  const line = markdownLines(value)[0] ?? ''

  return line.length > 80 ? `${line.slice(0, 80)}…` : line
}

export function entryLabel(row: ContentRow, field: Field | undefined, locale?: string): string {
  const value = field && chips(localized(row[field.key], field.translated ? locale : undefined))[0]

  return (value && condense(value)) || String(row.id)
}

export function titleField<TField extends Field>(fields: TField[]): TField | undefined {
  return fields.find(field => field.type === 'text')
    ?? fields.find(field => field.type === 'richtext')
}

export function fieldLocale(field: Field, locales: readonly string[]): string {
  return field.translated ? locales[0] ?? SINGLE : SINGLE
}

function empty(field: Field): unknown {
  const element = field.element

  if (element.type === 'number')
    return null

  if (element.type === 'dynamic')
    return []

  if (element.type === 'relation')
    return element.multiple ? [] : ''

  if (element.type === 'image' || element.type === 'video')
    return element.multiple ? [] : null

  return ''
}

export function toValues(fields: Field[], row: ContentRow, locales: readonly string[]): EntryValues {
  return Object.fromEntries(fields.map((field) => {
    const current = row[field.key]

    if (!field.translated)
      return [field.key, { [SINGLE]: current ?? empty(field) }]

    const translations = (typeof current === 'object' && current !== null ? current : {}) as Record<string, unknown>

    return [field.key, Object.fromEntries(locales.map(locale => [locale, translations[locale] ?? empty(field)]))]
  }))
}

export function fromValues(field: Field, values: EntryValues): unknown {
  const value = values[field.key]!

  if (!field.translated)
    return filled(value[SINGLE]) ? value[SINGLE] : undefined

  const translations = Object.entries(value).filter(([, item]) => filled(item))

  return translations.length ? Object.fromEntries(translations) : undefined
}

export function missingFields<TField extends Field>(fields: TField[], values: EntryValues): TField[] {
  return fields.filter((field) => {
    if (field.optional)
      return false

    const value = values[field.key]!

    return field.translated
      ? Object.values(value).some(translation => !filled(translation))
      : !filled(value[SINGLE])
  })
}
