import type { ForgePressSchema } from '../schema/types'
import type { Effect, EffectKind, Fill, Fix, RenameQuestion, Renames } from './types'
import { isEntryRef } from '../entries/references'
import { isTranslated } from '../schema/fields'
import { isMedia, isTranslations } from './convert'

export interface EffectGroup {
  key: string
  kind: EffectKind
  collection: string
  field: string | undefined
  label: string | undefined
  locales: string[]
  effects: Effect[]
  entries: number
}

export interface Choice<TValue extends string> {
  label: string
  value: TValue
}

export interface FillOptions {
  types: Choice<Fill['type']>[]
  fields: Choice<string>[]
  texts: Choice<string>[]
  locales: Choice<string>[]
}

const WIDTH = 60

function truncate(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text
}

export function groupEffects(effects: readonly Effect[], kinds: readonly EffectKind[], byLocale = true): EffectGroup[] {
  const groups = new Map<string, EffectGroup>()

  for (const effect of effects) {
    if (!kinds.includes(effect.kind))
      continue

    const locale = byLocale ? effect.locale ?? '' : ''
    const key = [effect.kind, effect.collection, effect.field ?? '', locale].join('/')
    const group = groups.get(key) ?? { key, kind: effect.kind, collection: effect.collection, field: effect.field, label: effect.label, locales: [], effects: [], entries: 0 }

    if (effect.locale !== undefined && !group.locales.includes(effect.locale))
      group.locales.push(effect.locale)

    group.effects.push(effect)
    group.entries = new Set(group.effects.map(item => item.id)).size
    groups.set(key, group)
  }

  return [...groups.values()]
}

export function collectionLabel(name: string, ...schemas: ForgePressSchema[]): string {
  return schemas.map(schema => schema.collections[name]?.label).find(label => label !== undefined) ?? name
}

export function groupTitle(group: EffectGroup, ...schemas: ForgePressSchema[]): string {
  const collection = collectionLabel(group.collection, ...schemas)
  const name = group.field === undefined ? collection : `${collection} · ${group.label ?? group.field}`

  return group.locales.length > 0 ? `${name} (${group.locales.map(locale => locale.toUpperCase()).join(', ')})` : name
}

export function entryCount(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`
}

export function groupCount(group: EffectGroup): string {
  const entries = entryCount(group.entries)

  if (group.kind === 'removed')
    return `${entries} deleted`

  if (group.kind === 'lost')
    return `${entries} ${group.entries === 1 ? 'loses' : 'lose'} a value`

  if (group.kind === 'created')
    return `${entries} added`

  return entries
}

export function questionText(question: RenameQuestion, ...schemas: ForgePressSchema[]): string {
  if (question.kind === 'collection')
    return `Entries are stored for ${question.from}, which isn't a collection anymore.`

  if (question.kind === 'field')
    return `${collectionLabel(question.collection!, ...schemas)} entries hold ${question.from}, which isn't a field anymore.`

  return `Translations use the locale ${question.from}, which isn't in the schema anymore.`
}

export function fillOptions(schema: ForgePressSchema, group: EffectGroup): FillOptions {
  const fields = schema.collections[group.collection]?.fields ?? {}
  const field = group.field === undefined ? undefined : fields[group.field]
  const locales = schema.locales ?? []
  const others = Object.entries(fields).filter(([key]) => key !== group.field)
  const choice = ([key, item]: [string, { label?: string }]): Choice<string> => ({ label: item.label ?? key, value: key })

  const options: FillOptions = {
    types: [{ label: 'Leave empty, fill in later', value: 'empty' }],
    fields: others.map(choice),
    texts: others.filter(([, item]) => item.type === 'text' || item.type === 'richtext').map(choice),
    locales: field && isTranslated(field, locales) ? locales.filter(locale => !group.locales.includes(locale)).map(locale => ({ label: locale.toUpperCase(), value: locale })) : [],
  }

  if (field?.type === 'text' || field?.type === 'richtext' || field?.type === 'number')
    options.types.push({ label: 'Use the same value', value: 'value' })

  if (options.locales.length > 0)
    options.types.push({ label: 'Copy another locale', value: 'locale' })

  if (options.fields.length > 0)
    options.types.push({ label: 'Copy another field', value: 'field' })

  if (field?.type === 'text' && options.texts.length > 0)
    options.types.push({ label: 'Make a slug of another field', value: 'slug' })

  return options
}

export function fixOptions(schema: ForgePressSchema, group: EffectGroup): Choice<Fix>[] {
  const field = group.field === undefined ? undefined : schema.collections[group.collection]?.fields[group.field]

  return [
    { label: 'Keep them, fix them later', value: 'keep' },
    { label: 'Remove the values', value: 'clear' },
    ...field?.type === 'number' ? [{ label: 'Use the nearest allowed number', value: 'nearest' as const }] : [],
  ]
}

export function describeValue(value: unknown, width = WIDTH): string {
  if (value === undefined || value === null)
    return '—'

  if (typeof value === 'string')
    return truncate(value.split('\n').find(line => line.trim() !== '')?.trim() ?? '""', width)

  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)

  if (Array.isArray(value))
    return truncate(value.map(item => describeValue(item, width)).join(', '), width)

  if (isMedia(value))
    return truncate(value.url, width)

  if (isEntryRef(value))
    return truncate(`${value.collection} ${value.id}`, width)

  if (isTranslations(value))
    return truncate(Object.entries(value).map(([locale, item]) => `${locale}: ${describeValue(item, width)}`).join(' · '), width)

  return truncate(JSON.stringify(value), width)
}

export function renameHints(renames: Renames): string[] {
  return [
    ...Object.entries(renames.collections ?? {}).map(([from, to]) => `query('${from}') becomes query('${to}')`),
    ...Object.entries(renames.fields ?? {}).flatMap(([collection, fields]) => Object.entries(fields).map(([from, to]) => `${collection}.${from} becomes ${collection}.${to}`)),
    ...Object.entries(renames.locales ?? {}).map(([from, to]) => `.locale('${from}') becomes .locale('${to}')`),
  ]
}
