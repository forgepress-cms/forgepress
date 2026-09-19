import type { Entry } from '../entries/types'
import type { Field } from '../schema/fields'
import type { Collection } from '../schema/types'
import type { EntryWrite } from '../store/types'
import type { Conversion, Links, LocaleMap } from './convert'
import type { Effect, Fill, Fix, Migration, MigrationInput } from './types'
import { entryId } from '../entries/id'
import { META_KEYS } from '../entries/meta'
import { validateField } from '../entries/validate'
import { isTranslated } from '../schema/fields'
import { defaultLocale } from '../schema/locales'
import { filled, isRecord, same } from '../utils/value'
import { convertField, isTranslations, single } from './convert'
import { nearest, slugify } from './fill'
import { entryTitle, normalize, textOf, titleKey } from './lookup'

type Note = (effect: Omit<Effect, 'collection' | 'id' | 'title'>) => void

type Row = Record<string, unknown>

interface Target {
  source: string
  entries: ReadonlyMap<string, Entry>
}

const META: ReadonlySet<string> = new Set(META_KEYS)

export function invert(record: Readonly<Record<string, string>> = {}): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([from, to]) => [to, from]))
}

export function leaves(value: unknown): number {
  if (Array.isArray(value))
    return value.reduce<number>((total, item) => total + leaves(item), 0)

  if (isTranslations(value))
    return Object.values(value).reduce<number>((total, item) => total + leaves(item), 0)

  return value === undefined || value === null || value === '' ? 0 : 1
}

function gaps(value: unknown, field: Field, locales: readonly string[]): (string | undefined)[] {
  if (field.optional)
    return []

  if (!isTranslated(field, locales))
    return value === undefined ? [undefined] : []

  if (value === undefined)
    return [...locales]

  return isRecord(value) ? locales.filter(locale => value[locale] === undefined) : []
}

function constraints(key: string, field: Field | undefined, value: unknown, locales: readonly string[]): { path: readonly (string | number)[], message: string }[] {
  if (!field || value === undefined)
    return []

  return validateField(key, { ...field, optional: true } as Field, value, locales).filter(issue => issue.kind === 'constraint')
}

export function planMigration(input: MigrationInput): Migration {
  const { before, after, content, renames = {}, decisions = {}, repair = false } = input
  const now = input.now ?? new Date().toISOString()
  const createId = input.id ?? entryId
  const effects: Effect[] = []
  const blocked: string[] = []
  const write: EntryWrite[] = []
  const removed: string[] = []

  const collectionRenames = renames.collections ?? {}
  const rename = (name: string): string => collectionRenames[name] ?? name
  const localeRenames = renames.locales ?? {}
  const localeSources = invert(localeRenames)

  const locales: LocaleMap = {
    before: before.locales ?? [],
    after: after.locales ?? [],
    defaults: { before: defaultLocale(before), after: defaultLocale(after) },
    rename: locale => localeRenames[locale] ?? locale,
    source: locale => localeSources[locale] ?? locale,
  }

  const sources = [...new Set([...Object.keys(before.collections), ...repair ? Object.keys(content) : []])]
  const targets = new Map<string, Target>()

  for (const source of sources) {
    const target = rename(source)

    if (!after.collections[target])
      continue

    const taken = targets.get(target)

    if (taken)
      blocked.push(`${source} and ${taken.source} would both become ${target}`)
    else
      targets.set(target, { source, entries: new Map((content[source] ?? []).map(row => [row.id, row])) })
  }

  const titles = new Map<string, Map<string, string>>()
  const created = new Map<string, Map<string, Entry>>()

  function sourceTitle(target: string, row: Entry): string | undefined {
    const found = targets.get(target)
    const key = titleKey(before.collections[found?.source ?? target] ?? after.collections[target])

    return key === undefined ? undefined : textOf(row[key], locales.before)
  }

  function titleIndex(target: string): Map<string, string> {
    let index = titles.get(target)

    if (!index) {
      index = new Map()

      for (const row of targets.get(target)?.entries.values() ?? []) {
        const text = sourceTitle(target, row)

        if (text !== undefined && !index.has(normalize(text)))
          index.set(normalize(text), row.id)
      }

      titles.set(target, index)
    }

    return index
  }

  function create(target: string, text: string, holder: Row): string | undefined {
    const definition = after.collections[target]
    const key = titleKey(definition)
    const field = key === undefined ? undefined : definition?.fields[key]

    if (key === undefined || field === undefined)
      return undefined

    const index = created.get(target) ?? new Map<string, Entry>()
    const found = index.get(normalize(text))
    const entry = found ?? { id: createId(target), status: 'unpublished', createdAt: now, updatedAt: now, [key]: isTranslated(field, locales.after) ? { [locales.defaults.after!]: text.trim() } : text.trim() }

    if (holder.status === 'published')
      entry.status = 'published'

    index.set(normalize(text), entry)
    created.set(target, index)

    return entry.id
  }

  function links(collection: string, field: string, holder: Row, unmatched: string[]): Links {
    return {
      collection: rename,
      exists: (target, id) => targets.get(target)?.entries.has(id) === true || [...created.get(target)?.values() ?? []].some(entry => entry.id === id),
      title: (target, id) => {
        const row = targets.get(target)?.entries.get(id)

        return row ? sourceTitle(target, row) : undefined
      },
      match: (target, text) => titleIndex(target).get(normalize(text)) ?? created.get(target)?.get(normalize(text))?.id,
      holder: (id, allowed) => allowed.find(target => targets.get(target)?.entries.has(id)),
      unmatched: (target, text) => {
        const id = decisions.create?.[collection]?.includes(field) ? create(target, text, holder) : undefined

        if (id === undefined)
          unmatched.push(text)

        return id
      },
    }
  }

  function conversion(collection: string, field: string, holder: Row, unmatched: string[] = []): Conversion {
    return { links: links(collection, field, holder, unmatched), locales }
  }

  function record(note: Note, key: string, renamed: boolean, field: Field, value: unknown, converted: unknown, unmatched: boolean): void {
    const label = field.label ?? key

    if (isTranslations(value) && !isTranslations(converted) && !isTranslated(field, locales.after)) {
      const kept = [locales.source(locales.defaults.after ?? ''), locales.defaults.before ?? '', ...Object.keys(value)].find(locale => filled(value[locale]))

      for (const [locale, item] of Object.entries(value)) {
        if (locale === kept && leaves(converted) < leaves(item))
          note({ kind: unmatched ? 'unmatched' : 'lost', field: key, label, locale, before: item, after: converted })
        else if (locale === kept)
          note({ kind: 'converted', field: key, label, locale, before: item, after: converted })
        else if (leaves(item) > 0)
          note({ kind: 'lost', field: key, label, locale, before: item })
      }

      return
    }

    if (isTranslations(value) && isTranslations(converted)) {
      for (const [locale, item] of Object.entries(value)) {
        const kept = converted[locales.rename(locale)]

        if (leaves(kept) < leaves(item))
          note({ kind: unmatched ? 'unmatched' : 'lost', field: key, label, locale, before: item, after: kept })
        else if (renamed || locales.rename(locale) !== locale || !same(item, kept))
          note({ kind: 'converted', field: key, label, locale, before: item, after: kept })
      }

      return
    }

    if (leaves(converted) < leaves(value)) {
      const kept: unknown[] = Array.isArray(converted) ? converted : [converted]
      const items: unknown[] = Array.isArray(value) ? value : []
      const dropped = items.filter(item => !kept.some(other => same(other, item)))

      note({ kind: unmatched ? 'unmatched' : 'lost', field: key, label, before: dropped.length > 0 && dropped.length < items.length ? dropped : value, after: converted })
    }
    else if (renamed || !same(value, converted)) {
      note({ kind: 'converted', field: key, label, before: value, after: converted })
    }
  }

  function fillValue(next: Row, collection: string, key: string, field: Field, fill: Fill, locale: string | undefined, fields: Readonly<Record<string, Field>>): unknown {
    const pick = (name: string): unknown => {
      const value = next[name]
      const source = fields[name]

      if (!source || !isTranslated(source, locales.after) || !isRecord(value))
        return source ? value : undefined

      return (locale === undefined ? undefined : value[locale]) ?? value[locales.after[0]!]
    }

    const into = (value: unknown): unknown => value === undefined ? undefined : convertField(value, undefined, single(field), conversion(collection, key, next))

    switch (fill.type) {
      case 'value':
        return into(fill.value)

      case 'field':
        return fields[fill.field] ? convertField(pick(fill.field), single(fields[fill.field]!), single(field), conversion(collection, key, next)) : undefined

      case 'slug': {
        const text = textOf(pick(fill.field), [])

        return text === undefined ? undefined : into(slugify(text))
      }

      case 'locale':
        return isRecord(next[key]) ? next[key][fill.locale] : undefined

      default:
        return undefined
    }
  }

  function applyFill(next: Row, collection: string, key: string, field: Field, fill: Fill | undefined, fields: Readonly<Record<string, Field>>): void {
    if (!fill || fill.type === 'empty')
      return

    for (const locale of gaps(next[key], field, locales.after)) {
      const value = fillValue(next, collection, key, field, fill, locale, fields)

      if (value === undefined || (typeof value === 'string' && value === ''))
        continue

      next[key] = locale === undefined ? value : { ...isRecord(next[key]) ? next[key] : {}, [locale]: value }
    }
  }

  function applyFix(next: Row, key: string, field: Field, fix: Fix, note: Note | undefined): void {
    const noted = new Set<string | undefined>()

    for (const issue of constraints(key, field, next[key], locales.after)) {
      const locale = typeof issue.path[1] === 'string' ? issue.path[1] : undefined
      const current = next[key]
      const value = locale === undefined ? current : isRecord(current) ? current[locale] : undefined

      if (value === undefined)
        continue

      if (fix === 'keep' || (fix === 'nearest' && (field.type !== 'number' || typeof value !== 'number'))) {
        if (!noted.has(locale))
          note?.({ kind: 'invalid', field: key, label: field.label ?? key, ...locale === undefined ? {} : { locale }, before: value, message: issue.message })

        noted.add(locale)
        continue
      }

      const replacement = fix === 'nearest' && field.type === 'number' ? nearest(value as number, field) : undefined

      if (locale === undefined) {
        if (replacement === undefined)
          delete next[key]
        else
          next[key] = replacement
      }
      else if (isRecord(current)) {
        const { [locale]: _, ...rest } = current

        next[key] = replacement === undefined ? rest : { ...rest, [locale]: replacement }

        if (Object.keys(next[key] as Row).length === 0)
          delete next[key]
      }
    }
  }

  function settle(next: Row, collection: string, fields: Readonly<Record<string, Field>>, previous: Readonly<Record<string, Field>>, sourceKey: (key: string) => string, row: Row | undefined, note: Note): void {
    for (const [key, field] of Object.entries(fields)) {
      const from = sourceKey(key)
      const was = previous[from]
      const raw = row?.[from]
      const complete = was === undefined || gaps(raw, was, locales.before).length === 0
      const valid = constraints(from, was, raw, locales.before).length === 0

      if (field.type === 'boolean')
        applyFill(next, collection, key, field, { type: 'value', value: String(field.default ?? false) }, fields)
      else if (complete)
        applyFill(next, collection, key, field, decisions.fills?.[collection]?.[key], fields)

      applyFix(next, key, field, valid ? decisions.fixes?.[collection]?.[key] ?? 'keep' : 'keep', valid ? note : undefined)

      if (!complete)
        continue

      for (const locale of gaps(next[key], field, locales.after))
        note({ kind: 'missing', field: key, label: field.label ?? key, ...locale === undefined ? {} : { locale } })
    }
  }

  function migrateEntry(row: Entry, source: string, target: string, definition: Collection): Entry {
    const previous = before.collections[source]?.fields ?? {}
    const fields = definition.fields
    const fieldRenames = renames.fields?.[target] ?? {}
    const fieldSources = invert(fieldRenames)
    const title = entryTitle(row, before.collections[source] ?? definition, locales.before)
    const next: Row = {}
    const note: Note = effect => effects.push({ collection: target, id: row.id, title, ...effect })

    for (const [key, value] of Object.entries(row)) {
      const renamed = fieldRenames[key] ?? key
      const field = fields[renamed]

      if (META.has(key)) {
        next[key] = value
      }
      else if (field && (fieldSources[renamed] ?? renamed) === key) {
        const unmatched: string[] = []
        const converted = convertField(value, previous[key], field, conversion(target, renamed, row, unmatched))

        if (converted !== undefined)
          next[renamed] = converted

        record(note, renamed, renamed !== key, field, value, converted, unmatched.length > 0)
      }
      else if (previous[key] || repair || fields[key]) {
        if (leaves(value) > 0)
          note({ kind: 'lost', field: key, label: previous[key]?.label ?? key, before: value })
      }
      else {
        next[key] = value
      }
    }

    settle(next, target, fields, previous, key => fieldSources[key] ?? key, row, note)

    return next as Entry
  }

  for (const source of sources) {
    const target = rename(source)
    const definition = after.collections[target]
    const rows = content[source] ?? []

    if (!definition) {
      for (const row of rows)
        effects.push({ kind: 'removed', collection: source, id: row.id, title: entryTitle(row, before.collections[source], locales.before) })

      removed.push(source)
      continue
    }

    if (targets.get(target)?.source !== source)
      continue

    if (target !== source)
      removed.push(source)

    for (const row of rows) {
      const next = migrateEntry(row, source, target, definition)

      if (target !== source || !same(next, row))
        write.push({ collection: target, entry: next })
    }
  }

  for (const [target, index] of created) {
    const definition = after.collections[target]!

    for (const entry of index.values()) {
      const title = entryTitle(entry, definition, locales.after)
      const note: Note = effect => effects.push({ collection: target, id: entry.id, title, ...effect })

      effects.push({ kind: 'created', collection: target, id: entry.id, title })
      settle(entry, target, definition.fields, {}, key => key, undefined, note)
      write.push({ collection: target, entry })
    }
  }

  for (const { collection, entry } of write) {
    for (const [key, field] of Object.entries(after.collections[collection]?.fields ?? {})) {
      for (const issue of validateField(key, { ...field, optional: true } as Field, entry[key], locales.after)) {
        if (issue.kind === 'type')
          blocked.push(`${collection}/${entry.id}: ${issue.message}`)
      }
    }
  }

  return {
    changeset: { schema: after, write, collections: removed },
    effects,
    blocked,
  }
}
