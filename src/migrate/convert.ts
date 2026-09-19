import type { EntryRef } from '../entries/types'
import type { Field } from '../schema/fields'
import type { DynamicField } from '../schema/fields/dynamic'
import { isEntryRef } from '../entries/references'
import { isTranslated } from '../schema/fields'
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

export interface Conversion {
  links: Links
  locales: LocaleMap
}

type Kind = 'text' | 'number' | 'boolean' | 'media' | 'relation' | 'block' | 'other'

export function isMedia(value: unknown): value is Record<string, unknown> & { url: string } {
  return isRecord(value) && typeof value.url === 'string'
}

export function isTranslations(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !isMedia(value) && !isEntryRef(value)
}

export function isListed(field: Field): boolean {
  return field.type === 'dynamic' || ('multiple' in field && field.multiple === true)
}

export function single(field: Field): Field {
  const { translate: _, ...rest } = field

  return rest as Field
}

function fits(item: unknown, field: Field): boolean {
  switch (field.type) {
    case 'number':
      return typeof item === 'number' && Number.isFinite(item)

    case 'boolean':
      return typeof item === 'boolean'

    case 'image':
    case 'video':
      return isMedia(item)

    case 'dynamic':
      return isEntryRef(item)

    default:
      return typeof item === 'string'
  }
}

function kindOf(item: unknown, before: Field | undefined): Kind {
  if (before?.type === 'relation' && fits(item, before))
    return 'relation'

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
  if (kind === 'relation' && before?.type === 'relation')
    return links.title(links.collection(before.collection), item as string)

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

function toMedia(item: unknown, kind: Kind): Record<string, unknown> | undefined {
  if (kind === 'media')
    return media(item as Record<string, unknown> & { url: string })

  const text = kind === 'text' ? (item as string).trim() : ''

  return ADDRESS.test(text) ? { url: text } : undefined
}

function toId(item: unknown, kind: Kind, before: Field | undefined, target: string, links: Links): string | undefined {
  if (kind === 'relation' && before?.type === 'relation') {
    const id = item as string

    if (links.exists(target, id))
      return id

    return links.match(target, id) ?? (links.collection(before.collection) === target ? id : undefined)
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

function toBlock(item: unknown, kind: Kind, before: Field | undefined, field: DynamicField, links: Links): EntryRef | undefined {
  const allowed = (collection: string, id: string): EntryRef | undefined => field.collections.includes(collection) ? { collection, id } : undefined

  if (kind === 'block') {
    const block = item as EntryRef

    return allowed(links.collection(block.collection), block.id)
  }

  if (kind === 'relation' && before?.type === 'relation')
    return allowed(links.collection(before.collection), item as string)

  const holder = kind === 'text' ? links.holder(item as string, field.collections) : undefined

  return holder ? { collection: holder, id: item as string } : undefined
}

function convertItem(item: unknown, before: Field | undefined, after: Field, links: Links): unknown {
  const kind = kindOf(item, before)

  switch (after.type) {
    case 'text':
    case 'richtext':
      return toText(item, kind, before, links)

    case 'number':
      return toNumber(item, kind)

    case 'boolean':
      return toBoolean(item, kind)

    case 'image':
    case 'video':
      return toMedia(item, kind)

    case 'relation':
      return toId(item, kind, before, after.collection, links)

    case 'dynamic':
      return toBlock(item, kind, before, after, links)
  }
}

function convertValue(value: unknown, before: Field | undefined, after: Field, links: Links): unknown {
  if (value === undefined)
    return undefined

  const converted = (Array.isArray(value) ? value : [value])
    .map(item => convertItem(item, before, after, links))
    .filter(item => item !== undefined)

  if (!isListed(after))
    return converted[0]

  return converted.length > 0 || Array.isArray(value) ? converted : undefined
}

export function convertField(value: unknown, before: Field | undefined, after: Field, conversion: Conversion): unknown {
  const { links, locales } = conversion
  const translated = isTranslated(after, locales.after)

  if (isTranslations(value)) {
    if (!translated) {
      const preferred = [locales.source(locales.defaults.after ?? ''), locales.defaults.before ?? '']
      const kept = preferred.map(locale => value[locale]).find(filled) ?? Object.values(value).find(filled)

      return convertValue(kept, before, after, links)
    }

    const kept = Object.entries(value).flatMap(([locale, item]) => {
      const target = locales.rename(locale)
      const converted = locales.after.includes(target) ? convertValue(item, before, after, links) : undefined

      return converted === undefined ? [] : [[target, converted] as const]
    })

    return kept.length > 0 ? Object.fromEntries(kept) : undefined
  }

  const converted = convertValue(value, before, after, links)

  return translated && converted !== undefined ? { [locales.after[0]!]: converted } : converted
}
