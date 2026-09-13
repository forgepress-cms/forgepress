import type { Field } from '../../fields'
import type { ForgePressSchema } from '../../types/core/schema'
import { fieldTypes } from '../../fields'

export const FIELD_ICONS: Record<string, string> = {
  text: 'i-lucide-type',
  richtext: 'i-lucide-text',
  number: 'i-lucide-hash',
  image: 'i-lucide-image',
  video: 'i-lucide-video',
  relation: 'i-lucide-link',
  dynamic: 'i-lucide-blocks',
}

export type SchemaCollection = ForgePressSchema['collections'][string]

export interface FormField {
  key: string
  label: string
  description: string
  type: Field['type']
  typeLabel: string
  icon: string
  config: Field
  translated: boolean
  optional: boolean
}

export function toFields(collection: SchemaCollection, locales: readonly string[] = []): FormField[] {
  return Object.entries(collection.fields).map(([key, config]) => ({
    key,
    label: config.label ?? key,
    description: config.description ?? '',
    type: config.type,
    typeLabel: fieldTypes[config.type].label,
    icon: FIELD_ICONS[config.type] ?? 'i-lucide-square',
    config,
    translated: (config.translate ?? false) && locales.length > 0,
    optional: config.optional ?? false,
  }))
}

export const KEY_PATTERN = /^[a-z_$][\w$]*$/i

export function toKey(value: string): string {
  const words = value.trim().replace(/[^\w\s$]/g, ' ').split(/[\s_]+/).filter(Boolean)

  const key = words
    .map((word, index) => index === 0 ? word : word[0]!.toUpperCase() + word.slice(1))
    .join('')
    .replace(/^[^a-z_$]+/i, '')

  return key ? key[0]!.toLowerCase() + key.slice(1) : key
}

export function moveKey<TValue>(record: Record<string, TValue>, key: string, offset: number): Record<string, TValue> {
  const keys = Object.keys(record)
  const from = keys.indexOf(key)
  const to = from + offset

  if (from < 0 || to < 0 || to >= keys.length)
    return record

  keys.splice(to, 0, ...keys.splice(from, 1))

  return Object.fromEntries(keys.map(name => [name, record[name]!]))
}

export function seedField(type: Field['type'], collections: string[]): Record<string, unknown> {
  const config: Record<string, unknown> = { type }

  for (const [option, spec] of Object.entries(fieldTypes[type].options)) {
    if (!('required' in spec))
      continue

    config[option] = spec.type === 'collections'
      ? []
      : spec.type === 'number' ? 0 : spec.type === 'boolean' ? false : collections[0] ?? ''
  }

  return config
}
