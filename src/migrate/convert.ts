import type { EntryRef } from '../entries/types'
import type { Field } from '../schema/fields'
import type { CollectionField } from '../schema/fields/collection'
import type { ComponentField } from '../schema/fields/component'
import type { ListField } from '../schema/fields/list'
import type { Component } from '../schema/types'
import { isEntryRef } from '../entries/references'
import { isTranslated } from '../schema/fields'
import { itemComponent } from '../schema/fields/component'
import { COMPONENT_KEY, onlyName } from '../schema/fields/picked'
import { filled, isRecord } from '../utils/value'

const ADDRESS = /^(?:\/|https?:\/\/)\S+$/
const TRUE = ['true', 'yes', 'on', '1']
const FALSE = ['false', 'no', 'off', '0']

export interface Links {
  collection: (name: string) => string
  exists: (collection: string, id: string) => boolean
  title: (collection: string, id: string) => string | undefined
  match: (collection: string, text: string) => string | undefined
  holder: (id: string, collections: readonly string[]) => string | undefined
  unmatched: (collection: string, text: string) => string | undefined
}

export interface LocaleMap {
  before: readonly string[]
  after: readonly string[]
  defaults: { before: string | undefined, after: string | undefined }
  rename: (locale: string) => string
  source: (locale: string) => string
}

export interface ComponentMap {
  before: Readonly<Record<string, Component>>
  after: Readonly<Record<string, Component>>
  rename: (name: string) => string
  fields: (component: string) => Readonly<Record<string, string>>
}

export interface Conversion {
  links: Links
  locales: LocaleMap
  components: ComponentMap
}

type Row = Record<string, unknown>

type Kind = 'text' | 'number' | 'boolean' | 'media' | 'id' | 'block' | 'other'

export function isMedia(value: unknown): value is Record<string, unknown> & { url: string } {
  return isRecord(value) && typeof value.url === 'string'
}

export function isTranslations(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !isMedia(value) && !isEntryRef(value)
}

export function sameComponents(components: Readonly<Record<string, Component>> = {}): ComponentMap {
  return { before: components, after: components, rename: name => name, fields: () => ({}) }
}

export function hasTranslations(value: unknown, before: Field | undefined, after: Field, locales: LocaleMap): value is Row {
  if (!isTranslations(value))
    return false

  if (after.type !== 'component' && before?.type !== 'component')
    return true

  if (before)
    return isTranslated(before, locales.before)

  return Object.keys(value).every(key => locales.before.includes(key) || locales.after.includes(key))
}

export function isListed(field: Field): boolean {
  return 'multiple' in field && field.multiple === true
}

function onlyCollection(field: Field | undefined): string | undefined {
  return field?.type === 'collection' ? onlyName(field.collections) : undefined
}

export function single(field: Field): Field {
  const { translate: _, ...rest } = field

  return rest as Field
}

function kindOf(item: unknown, before: Field | undefined): Kind {
  if (onlyCollection(before) !== undefined && typeof item === 'string')
    return 'id'

  if (typeof item === 'string')
    return 'text'

  if (typeof item === 'number' && Number.isFinite(item))
    return 'number'

  if (typeof item === 'boolean')
    return 'boolean'

  if (isEntryRef(item))
    return 'block'

  return isMedia(item) ? 'media' : 'other'
}

function media(item: Record<string, unknown> & { url: string }): Record<string, unknown> {
  const kept: Record<string, unknown> = { url: item.url }

  if (typeof item.alt === 'string')
    kept.alt = item.alt

  for (const size of ['width', 'height']) {
    if (typeof item[size] === 'number' && Number.isFinite(item[size]))
      kept[size] = item[size]
  }

  return kept
}

function toText(item: unknown, kind: Kind, before: Field | undefined, links: Links): string | undefined {
  const source = onlyCollection(before)

  if (kind === 'id' && source !== undefined)
    return links.title(links.collection(source), item as string)

  if (kind === 'block')
    return links.title(links.collection((item as EntryRef).collection), (item as EntryRef).id)

  if (kind === 'text')
    return item as string

  return kind === 'number' || kind === 'boolean' ? String(item) : undefined
}

function toNumber(item: unknown, kind: Kind): number | undefined {
  if (kind === 'number')
    return item as number

  if (kind === 'boolean')
    return item ? 1 : 0

  if (kind !== 'text')
    return undefined

  const text = (item as string).trim()
  const parsed = Number(text)

  return text !== '' && Number.isFinite(parsed) ? parsed : undefined
}

function toBoolean(item: unknown, kind: Kind): boolean | undefined {
  if (kind === 'boolean')
    return item as boolean

  if (kind === 'number')
    return item === 1 ? true : item === 0 ? false : undefined

  if (kind !== 'text')
    return undefined

  const text = (item as string).trim().toLowerCase()

  return TRUE.includes(text) ? true : FALSE.includes(text) ? false : undefined
}

function toChoice(item: unknown, kind: Kind, field: ListField): string | undefined {
  if (kind !== 'text')
    return undefined

  const text = (item as string).trim()

  return field.values.find(value => value === text) ?? field.values.find(value => value.toLowerCase() === text.toLowerCase())
}

function toMedia(item: unknown, kind: Kind): Record<string, unknown> | undefined {
  if (kind === 'media')
    return media(item as Record<string, unknown> & { url: string })

  const text = kind === 'text' ? (item as string).trim() : ''

  return ADDRESS.test(text) ? { url: text } : undefined
}

function toOnly(item: unknown, kind: Kind, before: Field | undefined, target: string, links: Links): string | undefined {
  const source = onlyCollection(before)

  if (kind === 'id' && source !== undefined) {
    const id = item as string

    if (links.exists(target, id))
      return id

    return links.match(target, id) ?? (links.collection(source) === target ? id : undefined)
  }

  if (kind === 'block') {
    const block = item as EntryRef

    return links.collection(block.collection) === target ? block.id : undefined
  }

  if (kind !== 'text')
    return undefined

  const text = item as string

  if (links.exists(target, text))
    return text

  return text.trim() === '' ? undefined : links.match(target, text) ?? links.unmatched(target, text)
}

function toBlock(item: unknown, kind: Kind, before: Field | undefined, field: CollectionField, links: Links): EntryRef | undefined {
  const allowed = (collection: string, id: string): EntryRef | undefined => field.collections.includes(collection) ? { collection, id } : undefined
  const source = onlyCollection(before)

  if (kind === 'block') {
    const block = item as EntryRef

    return allowed(links.collection(block.collection), block.id)
  }

  if (kind === 'id' && source !== undefined)
    return allowed(links.collection(source), item as string)

  const holder = kind === 'text' ? links.holder(item as string, field.collections) : undefined

  return holder ? { collection: holder, id: item as string } : undefined
}

function toEntry(item: unknown, kind: Kind, before: Field | undefined, field: CollectionField, links: Links): unknown {
  const only = onlyName(field.collections)

  return only === undefined ? toBlock(item, kind, before, field, links) : toOnly(item, kind, before, only, links)
}

export function migrateItem(item: Row, previous: Readonly<Record<string, Field>>, fields: Readonly<Record<string, Field>>, renames: Readonly<Record<string, string>>, conversion: Conversion): Row {
  const sources = Object.fromEntries(Object.entries(renames).map(([from, to]) => [to, from]))
  const next: Row = {}

  for (const [key, value] of Object.entries(item)) {
    const target = renames[key] ?? key
    const field = fields[target]

    if (!field || (sources[target] ?? target) !== key)
      continue

    const converted = value === undefined ? undefined : convertField(value, previous[key], field, conversion)

    if (converted !== undefined)
      next[target] = converted
  }

  for (const [key, field] of Object.entries(fields)) {
    if (field.type === 'boolean' && next[key] === undefined)
      next[key] = field.default ?? false
  }

  return next
}

function toItem(item: unknown, before: Field | undefined, after: ComponentField, conversion: Conversion): Row | undefined {
  const { components } = conversion

  if ((before !== undefined && before.type !== 'component') || !isRecord(item))
    return undefined

  const source = before === undefined ? undefined : itemComponent(before, item)
  const target = source === undefined ? onlyName(after.components) : components.rename(source)

  if (target === undefined || !after.components.includes(target))
    return undefined

  const fields = components.after[target]?.fields ?? {}
  const previous = source === undefined ? fields : components.before[source]?.fields ?? {}
  const renames = source === undefined ? {} : components.fields(target)
  const migrated = migrateItem(item, previous, fields, renames, conversion)

  return onlyName(after.components) === undefined ? { [COMPONENT_KEY]: target, ...migrated } : migrated
}

function convertItem(item: unknown, before: Field | undefined, after: Field, conversion: Conversion): unknown {
  const { links } = conversion
  const kind = kindOf(item, before)

  switch (after.type) {
    case 'text':
    case 'richtext':
      return toText(item, kind, before, links)

    case 'number':
      return toNumber(item, kind)

    case 'boolean':
      return toBoolean(item, kind)

    case 'list':
      return toChoice(item, kind, after)

    case 'image':
    case 'video':
      return toMedia(item, kind)

    case 'collection':
      return toEntry(item, kind, before, after, links)

    case 'component':
      return toItem(item, before, after, conversion)
  }
}

function convertValue(value: unknown, before: Field | undefined, after: Field, conversion: Conversion): unknown {
  if (value === undefined)
    return undefined

  const converted = (Array.isArray(value) ? value : [value])
    .map(item => convertItem(item, before, after, conversion))
    .filter(item => item !== undefined)

  if (!isListed(after))
    return converted[0]

  return converted.length > 0 || Array.isArray(value) ? converted : undefined
}

export function convertField(value: unknown, before: Field | undefined, after: Field, conversion: Conversion): unknown {
  const { locales } = conversion
  const translated = isTranslated(after, locales.after)

  if (hasTranslations(value, before, after, locales)) {
    if (!translated) {
      const preferred = [locales.source(locales.defaults.after ?? ''), locales.defaults.before ?? '']
      const kept = preferred.map(locale => value[locale]).find(filled) ?? Object.values(value).find(filled)

      return convertValue(kept, before, after, conversion)
    }

    const kept = Object.entries(value).flatMap(([locale, item]) => {
      const target = locales.rename(locale)
      const converted = locales.after.includes(target) ? convertValue(item, before, after, conversion) : undefined

      return converted === undefined ? [] : [[target, converted] as const]
    })

    return kept.length > 0 ? Object.fromEntries(kept) : undefined
  }

  const converted = convertValue(value, before, after, conversion)

  return translated && converted !== undefined ? { [locales.after[0]!]: converted } : converted
}
