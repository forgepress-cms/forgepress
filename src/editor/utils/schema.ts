import type { ElementType } from '../../elements'
import type { WebenvSchema } from '../../types/core/schema'
import { elements } from '../../elements'

export const ELEMENT_ICONS: Record<string, string> = {
  text: 'i-lucide-type',
  richtext: 'i-lucide-text',
  number: 'i-lucide-hash',
  image: 'i-lucide-image',
  video: 'i-lucide-video',
  relation: 'i-lucide-link',
  dynamic: 'i-lucide-blocks',
}

export type SchemaComponent = WebenvSchema['components'][string]

export interface Field {
  key: string
  label: string
  description: string
  type: ElementType['type']
  typeLabel: string
  icon: string
  element: ElementType
  translated: boolean
  optional: boolean
}

export function toFields(component: SchemaComponent, locales: readonly string[] = []): Field[] {
  return Object.entries(component.elements).map(([key, element]) => ({
    key,
    label: element.label ?? key,
    description: element.description ?? '',
    type: element.type,
    typeLabel: elements[element.type].label,
    icon: ELEMENT_ICONS[element.type] ?? 'i-lucide-square',
    element,
    translated: (element.translate ?? false) && locales.length > 0,
    optional: element.optional ?? false,
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

export function seedElement(type: ElementType['type'], components: string[]): Record<string, unknown> {
  const element: Record<string, unknown> = { type }

  for (const [option, spec] of Object.entries(elements[type].options)) {
    if (!('required' in spec))
      continue

    element[option] = spec.type === 'components'
      ? []
      : spec.type === 'number' ? 0 : spec.type === 'boolean' ? false : components[0] ?? ''
  }

  return element
}
