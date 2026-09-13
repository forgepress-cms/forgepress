import type { Field } from '../schema/fields'
import type { DynamicField } from '../schema/fields/dynamic'
import type { NumberField } from '../schema/fields/number'
import type { TextField } from '../schema/fields/text'
import type { ValueIssue, ValuePath } from '../types/issues'
import type { ForgePressSchema } from '../types/schema'
import { isEntryId } from '../files/paths'
import { compilePattern } from '../schema/fields/text'
import { isRecord, quote } from '../utils/value'
import { META_KEYS } from './meta'

type Report = (path: ValuePath, message: string) => void

const STATUSES: readonly unknown[] = ['published', 'unpublished']
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/
const MEDIA_OPTIONS: Record<string, readonly [kind: string, fits: (value: unknown) => boolean]> = {
  url: ['a string', value => typeof value === 'string'],
  alt: ['a string', value => typeof value === 'string'],
  width: ['a number', value => typeof value === 'number'],
  height: ['a number', value => typeof value === 'number'],
}
const BLOCK_KEYS = new Set(['collection', 'id'])

function isDate(value: unknown): boolean {
  const match = typeof value === 'string' ? ISO_DATE.exec(value) : null

  if (!match || Number.isNaN(Date.parse(match[0])))
    return false

  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(Number(match[1]), month, day))

  return date.getUTCMonth() === month && date.getUTCDate() === day
}

function checkMeta(report: Report, entry: Record<string, unknown>): void {
  if (entry.id === undefined)
    report([], 'The entry needs an "id"')
  else if (typeof entry.id !== 'string' || !isEntryId(entry.id))
    report(['id'], '"id" has to be a string of letters, digits, "_" and "-"')

  if (entry.status === undefined)
    report([], 'The entry needs a "status"')
  else if (!STATUSES.includes(entry.status))
    report(['status'], '"status" has to be "published" or "unpublished"')

  for (const key of ['createdAt', 'updatedAt']) {
    if (entry[key] === undefined)
      report([], `The entry needs ${quote(key)}`)
    else if (!isDate(entry[key]))
      report([key], `${quote(key)} has to be an ISO 8601 date such as "2024-01-31T09:30:00Z"`)
  }
}

function checkList(report: Report, path: ValuePath, value: unknown, message: string, item: (path: ValuePath, value: unknown) => void): void {
  if (!Array.isArray(value))
    return report(path, message)

  value.forEach((entry, index) => item([...path, index], entry))
}

function checkId(report: Report, path: ValuePath, label: string, collection: string, value: unknown): void {
  if (typeof value !== 'string')
    report(path, `Field ${label} has to hold ids of ${quote(collection)} entries`)
}

function checkMedia(report: Report, path: ValuePath, label: string, value: unknown): void {
  if (!isRecord(value))
    return report(path, `Field ${label} has to be a media object such as { url: "/uploads/photo.jpg" }`)

  if (value.url === undefined)
    report(path, `Field ${label} needs a "url"`)

  for (const [option, item] of Object.entries(value)) {
    const spec = MEDIA_OPTIONS[option]

    if (spec === undefined)
      report([...path, option], `Field ${label} has no media option ${quote(option)}`)
    else if (!spec[1](item))
      report([...path, option], `${quote(option)} of field ${label} has to be ${spec[0]}`)
  }
}

function checkBlock(report: Report, path: ValuePath, label: string, field: DynamicField, value: unknown): void {
  if (!isRecord(value))
    return report(path, `Field ${label} has to hold blocks such as { collection: "…", id: "…" }`)

  if (typeof value.collection !== 'string')
    report(value.collection === undefined ? path : [...path, 'collection'], `A block in field ${label} needs a "collection"`)
  else if (!field.collections.includes(value.collection))
    report([...path, 'collection'], `Field ${label} can't hold ${quote(value.collection)} blocks; allowed are ${field.collections.join(', ') || 'none'}`)

  if (typeof value.id !== 'string')
    report(value.id === undefined ? path : [...path, 'id'], `A block in field ${label} needs an "id"`)

  for (const key of Object.keys(value)) {
    if (!BLOCK_KEYS.has(key))
      report([...path, key], `A block in field ${label} has no option ${quote(key)}`)
  }
}

function checkPattern(report: Report, path: ValuePath, label: string, field: TextField, value: string): void {
  const pattern = field.validation === undefined ? undefined : compilePattern(field.validation)

  if (pattern instanceof RegExp && !pattern.test(value))
    report(path, `Field ${label} has to match the pattern ${field.validation}`)
}

function checkRange(report: Report, path: ValuePath, label: string, field: NumberField, value: number): void {
  const { min, max, step } = field

  if (min !== undefined && value < min)
    report(path, `Field ${label} has to be at least ${min}`)

  if (max !== undefined && value > max)
    report(path, `Field ${label} has to be at most ${max}`)

  if (step === undefined || step <= 0)
    return

  const base = min ?? 0
  const steps = (value - base) / step

  if (Math.abs(steps - Math.round(steps)) <= 1e-9 * Math.max(1, Math.abs(steps)))
    return

  const nearest = [Math.floor(steps), Math.ceil(steps)]
    .map(count => Number((base + count * step).toPrecision(12)))
    .filter(candidate => (min === undefined || candidate >= min) && (max === undefined || candidate <= max))

  report(path, `Field ${label} has to be in steps of ${step}${base === 0 ? '' : ` from ${base}`}${nearest.length > 0 ? `, such as ${nearest.join(' or ')}` : ''}`)
}

function checkValue(report: Report, path: ValuePath, label: string, field: Field, value: unknown): void {
  switch (field.type) {
    case 'text':
      if (typeof value !== 'string')
        report(path, `Field ${label} has to be a string`)
      else
        checkPattern(report, path, label, field, value)
      return

    case 'richtext':
      if (typeof value !== 'string')
        report(path, `Field ${label} has to be a string`)
      return

    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value))
        report(path, `Field ${label} has to be a number`)
      else
        checkRange(report, path, label, field, value)
      return

    case 'image':
    case 'video':
      if (field.multiple)
        checkList(report, path, value, `Field ${label} has to be a list of media objects`, (at, item) => checkMedia(report, at, label, item))
      else
        checkMedia(report, path, label, value)
      return

    case 'relation':
      if (field.multiple)
        checkList(report, path, value, `Field ${label} has to be a list of ${quote(field.collection)} entry ids`, (at, item) => checkId(report, at, label, field.collection, item))
      else
        checkId(report, path, label, field.collection, value)
      return

    case 'dynamic':
      checkList(report, path, value, `Field ${label} has to be a list of blocks`, (at, item) => checkBlock(report, at, label, field, item))
  }
}

function checkTranslations(report: Report, key: string, field: Field, value: unknown, locales: readonly string[]): void {
  if (!isRecord(value))
    return report([key], `Field ${quote(key)} is translated and has to hold one value per locale, such as { ${locales[0]}: … }`)

  for (const [locale, item] of Object.entries(value)) {
    if (locales.includes(locale))
      checkValue(report, [key, locale], `${quote(key)} (${locale})`, field, item)
    else
      report([key, locale], `Field ${quote(key)} has no locale ${quote(locale)}; the schema has ${locales.join(', ')}`)
  }

  const missing = field.optional ? [] : locales.filter(locale => value[locale] === undefined)

  if (missing.length > 0)
    report([key], `Field ${quote(key)} is missing its ${missing.join(', ')} ${missing.length === 1 ? 'translation' : 'translations'}`)
}

export function validateEntry(schema: ForgePressSchema, collection: string, entry: unknown): ValueIssue[] {
  const issues: ValueIssue[] = []
  const report: Report = (path, message) => issues.push({ path, message })
  const definition = schema.collections[collection]
  const locales = schema.locales ?? []

  if (!isRecord(entry)) {
    report([], 'An entry has to be an object')

    return issues
  }

  if (!definition) {
    report([], `Collection ${quote(collection)} is not in the schema`)

    return issues
  }

  checkMeta(report, entry)

  for (const [key, value] of Object.entries(entry)) {
    if (value !== undefined && !(META_KEYS as readonly string[]).includes(key) && !Object.hasOwn(definition.fields, key))
      report([key], `${quote(key)} is not a field of collection ${quote(collection)}`)
  }

  for (const [key, field] of Object.entries(definition.fields)) {
    const value = entry[key]

    if (value === undefined) {
      if (!field.optional)
        report([], `Field ${quote(key)} is required`)
    }
    else if (field.translate && locales.length > 0) {
      checkTranslations(report, key, field, value, locales)
    }
    else {
      checkValue(report, [key], quote(key), field, value)
    }
  }

  return issues
}
