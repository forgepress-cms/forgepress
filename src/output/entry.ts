import type { Entry } from '../entries/types'
import type { Field } from '../schema/fields'
import type { ComponentField } from '../schema/fields/component'
import type { Component, ForgePressSchema } from '../schema/types'
import type { LinkedFields, LinkTarget, OutputEntry } from './types'
import { OUTPUT_META_KEYS } from '../entries/meta'
import { isTranslated, translatesAnything } from '../schema/fields'
import { itemComponent } from '../schema/fields/component'
import { mapItems, onlyName } from '../schema/fields/picked'
import { isRecord, pick } from '../utils/value'

function fieldsOf(schema: ForgePressSchema, collection: string): [string, Field][] {
  return Object.entries(schema.collections[collection]?.fields ?? {})
}

function translation(stored: unknown, locale: string | undefined): unknown {
  return locale !== undefined && isRecord(stored) ? stored[locale] : undefined
}

interface Resolve {
  components: Readonly<Record<string, Component>>
  locales: readonly string[]
  locale: string | undefined
}

function linkedItem(field: ComponentField, item: unknown, resolve: Resolve): unknown {
  if (!isRecord(item))
    return item

  const name = itemComponent(field, item)
  const fields = name === undefined ? {} : resolve.components[name]?.fields ?? {}

  return Object.fromEntries(Object.entries(item).flatMap(([key, value]) => {
    const inner = fields[key]

    if (!inner || value === undefined)
      return [[key, value]]

    const held = isTranslated(inner, resolve.locales) ? translation(value, resolve.locale) : value

    return held === undefined ? [] : [[key, linked(inner, held, resolve)]]
  }))
}

function linked(field: Field, value: unknown, resolve: Resolve): unknown {
  if (field.type === 'component')
    return mapItems(value, field.multiple, item => linkedItem(field, item, resolve))

  if (field.type !== 'collection')
    return value

  const only = onlyName(field.collections)
  const link = (id: unknown): unknown => only === undefined ? id : { collection: only, id }

  return mapItems(value, field.multiple, link)
}

export function isLocalized(schema: ForgePressSchema, collection: string): boolean {
  return translatesAnything(schema.collections[collection]?.fields ?? {}, schema.components ?? {}, schema.locales ?? [])
}

export function indexedFields(schema: ForgePressSchema, collection: string): string[] {
  return fieldsOf(schema, collection).filter(([, field]) => 'index' in field && field.index === true).map(([key]) => key)
}

function linkTarget(field: Field): LinkTarget | undefined {
  if (field.type === 'collection')
    return { collections: [...field.collections], multiple: field.multiple === true }

  return field.type === 'component' ? { components: [...field.components], multiple: field.multiple === true } : undefined
}

function linkTargets(fields: Readonly<Record<string, Field>>): LinkedFields {
  return Object.fromEntries(Object.entries(fields).flatMap(([key, field]) => {
    const target = linkTarget(field)

    return target === undefined ? [] : [[key, target]]
  }))
}

function held(links: LinkedFields): string[] {
  return Object.values(links).flatMap(target => 'components' in target ? target.components : [])
}

export function linkFields(schema: ForgePressSchema, collection: string): LinkedFields {
  return linkTargets(schema.collections[collection]?.fields ?? {})
}

export function linkedComponents(schema: ForgePressSchema, links: LinkedFields): Record<string, LinkedFields> | undefined {
  const defined = schema.components ?? {}
  const found: Record<string, LinkedFields> = {}
  const queue = held(links)
  const seen = new Set<string>()

  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    const component = defined[name]

    if (seen.has(name) || component === undefined)
      continue

    seen.add(name)

    const inner = linkTargets(component.fields)

    if (Object.keys(inner).length === 0)
      continue

    found[name] = inner
    queue.push(...held(inner))
  }

  return Object.keys(found).length > 0 ? found : undefined
}

export function toOutputEntry(schema: ForgePressSchema, collection: string, entry: Entry, locale?: string): OutputEntry {
  const locales = schema.locales ?? []
  const output = pick(entry, OUTPUT_META_KEYS) as OutputEntry

  for (const [key, field] of fieldsOf(schema, collection)) {
    const value = isTranslated(field, locales) ? translation(entry[key], locale) : entry[key]

    if (value !== undefined)
      output[key] = linked(field, value, { components: schema.components ?? {}, locales, locale })
  }

  return output
}
