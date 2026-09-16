import type { Field } from '../../src/schema/fields'
import type { FieldOption } from '../../src/schema/fields/types'
import type { Collection } from '../../src/schema/types'
import { fieldTypeNames, fieldTypes, isTranslated } from '../../src/schema/fields'

export const FIELD_ICONS: Record<string, string> = {
  text: 'i-hugeicons-text',
  richtext: 'i-hugeicons-text-align-left',
  number: 'i-hugeicons-hashtag',
  image: 'i-hugeicons-image-01',
  video: 'i-hugeicons-video-02',
  relation: 'i-hugeicons-link-01',
  dynamic: 'i-hugeicons-dashboard-square-01',
}

export const FIELD_TYPE_ITEMS = fieldTypeNames.map(type => ({ label: fieldTypes[type].label, value: type }))

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
    icon: FIELD_ICONS[config.type] ?? 'i-hugeicons-square',
    config,
    translated: isTranslated(config, locales),
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
