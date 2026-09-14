import type { Field } from '../../schema/fields'
import type { FieldOption } from '../../types/field'
import type { Collection } from '../../types/schema'
import { fieldTypes } from '../../schema/fields'

export const FIELD_ICONS: Record<string, string> = {
  text: 'i-lucide-type',
  richtext: 'i-lucide-text',
  number: 'i-lucide-hash',
  image: 'i-lucide-image',
  video: 'i-lucide-video',
  relation: 'i-lucide-link',
  dynamic: 'i-lucide-blocks',
}

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

export interface LocalizedField extends FormField {
  locale: string
}

export function toFields(collection: Collection, locales: readonly string[] = []): FormField[] {
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

export function seedOption(option: FieldOption): unknown {
  return option.type === 'boolean' ? false : option.type === 'collections' ? [] : option.type === 'number' ? null : ''
}

export function seedField(type: Field['type'], collections: string[]): Record<string, unknown> {
  const config: Record<string, unknown> = { type }

  for (const [option, spec] of Object.entries(fieldTypes[type].options)) {
    if ('required' in spec)
      config[option] = spec.type === 'collection' ? collections[0] ?? '' : seedOption(spec)
  }

  return config
}
