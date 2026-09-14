import type { Entry } from '../types/entry'
import type { Field } from './fields'
import { asList, filled, isRecord, same } from '../utils/value'

const TEXTUAL = new Set<Field['type']>(['text', 'richtext'])
const MEDIA = new Set<Field['type']>(['image', 'video'])

export interface Migration {
  rows: Entry[]
  changed: number
  lost: number
  missing: number
}

function listed(config: Field): boolean {
  return config.type === 'dynamic' || ('multiple' in config && config.multiple === true)
}

function translates(config: Field, locales: readonly string[]): boolean {
  return config.translate === true && locales.length > 0
}

function convert(value: unknown, before: Field, after: Field): unknown {
  if (after.type === 'relation')
    return before.type === 'relation' && before.collection === after.collection ? value : undefined

  if (after.type === 'dynamic') {
    const block = isRecord(value) ? value.collection : undefined

    return before.type === 'dynamic' && typeof block === 'string' && after.collections.includes(block) ? value : undefined
  }

  if (MEDIA.has(after.type))
    return MEDIA.has(before.type) ? value : undefined

  if (after.type === 'number') {
    if (before.type === 'number')
      return value

    const parsed = Number(value)

    return TEXTUAL.has(before.type) && typeof value === 'string' && value.trim() && Number.isFinite(parsed) ? parsed : undefined
  }

  if (TEXTUAL.has(after.type)) {
    if (TEXTUAL.has(before.type))
      return value

    return before.type === 'number' ? String(value) : undefined
  }

  return undefined
}

function migrateValue(value: unknown, before: Field, after: Field): unknown {
  const items = listed(before) ? asList(value) : filled(value) ? [value] : []
  const converted = items.map(item => convert(item, before, after)).filter(filled)

  if (!listed(after))
    return converted[0]

  return converted.length ? converted : undefined
}

function migrateField(value: unknown, before: Field, after: Field, locales: readonly string[]): unknown {
  const was = translates(before, locales)
  const is = translates(after, locales)

  if (was && is && isRecord(value)) {
    const translations = Object.entries(value)
      .map(([locale, item]) => [locale, migrateValue(item, before, after)] as const)
      .filter(([, item]) => item !== undefined)

    return translations.length ? Object.fromEntries(translations) : undefined
  }

  if (was) {
    const primary = isRecord(value) ? value[locales[0]!] ?? Object.values(value).find(filled) : value

    return migrateValue(primary, before, after)
  }

  const migrated = migrateValue(value, before, after)

  if (!is || migrated === undefined)
    return migrated

  return { [locales[0]!]: migrated }
}

function size(value: unknown, translated: boolean): number {
  if (translated && isRecord(value))
    return Object.values(value).reduce<number>((total, item) => total + size(item, false), 0)

  if (Array.isArray(value))
    return value.length

  return filled(value) ? 1 : 0
}

function complete(value: unknown, after: Field, locales: readonly string[]): boolean {
  if (!filled(value))
    return false

  if (!translates(after, locales))
    return true

  return isRecord(value) && locales.every(locale => filled(value[locale]))
}

export function migrate(
  rows: Entry[],
  key: string,
  before: Field,
  after: Field,
  locales: readonly string[] = [],
): Migration {
  let changed = 0
  let lost = 0
  let missing = 0

  const migrated = rows.map((row) => {
    const value = row[key]
    const next = migrateField(value, before, after, locales)

    if (!same(next, value))
      changed += 1

    if (size(next, translates(after, locales)) < size(value, translates(before, locales)))
      lost += 1

    if (after.optional !== true && !complete(next, after, locales))
      missing += 1

    const copy: Entry = { ...row }

    if (next === undefined)
      delete copy[key]
    else
      copy[key] = next

    return copy
  })

  return { rows: migrated, changed, lost, missing }
}
