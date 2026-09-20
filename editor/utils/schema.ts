import type { Field } from '../../src/schema/fields'
import type { FieldOption, FieldTypeDefinition } from '../../src/schema/fields/types'
import type { Collection, Component } from '../../src/schema/types'
import { fieldTypeNames, fieldTypes, isTranslated } from '../../src/schema/fields'

export const FIELD_ICONS: Record<string, string> = {
  text: 'i-hugeicons-text',
  richtext: 'i-hugeicons-text-align-left',
  number: 'i-hugeicons-hashtag',
  boolean: 'i-hugeicons-toggle-on',
  list: 'i-hugeicons-left-to-right-list-bullet',
  image: 'i-hugeicons-image-01',
  video: 'i-hugeicons-video-02',
  collection: 'i-hugeicons-link-01',
  component: 'i-hugeicons-layers-01',
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
  components?: ComponentForm[]
}

export interface ComponentForm {
  name: string
  label: string
  fields: FormField[]
}

export interface LocalizedField extends FormField {
  locale: string
}

function fieldsOf(holder: Collection | Component, locales: readonly string[], forms: Readonly<Record<string, ComponentForm>>): FormField[] {
  return Object.entries(holder.fields).map(([key, config]) => ({
    key,
    label: config.label ?? key,
    description: config.description ?? '',
    type: config.type,
    typeLabel: fieldTypes[config.type].label,
    icon: FIELD_ICONS[config.type] ?? 'i-hugeicons-square',
    config,
    translated: isTranslated(config, locales),
    optional: config.optional ?? false,
    ...config.type === 'component' ? { components: config.components.flatMap(name => forms[name] ?? []) } : {},
  }))
}

export function componentForms(components: Readonly<Record<string, Component>>, locales: readonly string[] = []): Record<string, ComponentForm> {
  const forms: Record<string, ComponentForm> = Object.fromEntries(Object.entries(components)
    .map(([name, definition]) => [name, { name, label: definition.label ?? name, fields: [] }]))

  for (const [name, definition] of Object.entries(components))
    forms[name]!.fields = fieldsOf(definition, locales, forms)

  return forms
}

export function toFields(collection: Collection, locales: readonly string[] = [], components: Readonly<Record<string, Component>> = {}): FormField[] {
  return fieldsOf(collection, locales, componentForms(components, locales))
}

export function allowsOptional(type: Field['type']): boolean {
  return !(fieldTypes[type] as FieldTypeDefinition).without?.includes('optional')
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
  if (option.type === 'boolean')
    return false

  if (option.type === 'collections' || option.type === 'components' || option.type === 'strings')
    return []

  return option.type === 'number' ? null : ''
}

export function seedField(type: Field['type'], collections: string[], components: string[] = []): Record<string, unknown> {
  const config: Record<string, unknown> = { type }

  for (const [option, spec] of Object.entries(fieldTypes[type].options)) {
    if (!('required' in spec))
      continue

    if (spec.type === 'collections')
      config[option] = collections.slice(0, 1)
    else if (spec.type === 'components')
      config[option] = components.slice(0, 1)
    else
      config[option] = seedOption(spec)
  }

  return config
}
