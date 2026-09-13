import type { FieldOptionType } from '../types/field'
import type { ValueIssue, ValuePath } from '../types/issues'
import { META_KEYS } from '../entries/meta'
import { isRecord, quote } from '../utils/value'
import { fieldTypeNames, fieldTypes } from './fields'
import { compilePattern } from './fields/text'

export const COLLECTION_NAME = /^[a-z][a-zA-Z\d]*$/
export const LOCALE_CODE = /^[a-z][\w-]*$/i
export const RESERVED_FIELDS: readonly string[] = META_KEYS

type FieldType = keyof typeof fieldTypes

type Report = (path: ValuePath, message: string) => void

interface Context {
  report: Report
  collections: ReadonlySet<string>
  locales: readonly unknown[]
}

const SCHEMA_KEYS = new Set(['collections', 'locales'])
const COLLECTION_KEYS = new Set(['label', 'description', 'fields'])

const BASE_OPTIONS: Record<string, FieldOptionType> = {
  label: 'text',
  description: 'text',
  optional: 'boolean',
  translate: 'boolean',
}

const KINDS: Record<FieldOptionType, string> = {
  text: 'a string',
  number: 'a number',
  boolean: 'true or false',
  collection: 'a collection name',
  collections: 'a list of collection names',
}

function isFieldType(type: unknown): type is FieldType {
  return typeof type === 'string' && (fieldTypeNames as string[]).includes(type)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function fits(kind: FieldOptionType, value: unknown): boolean {
  if (kind === 'number')
    return finite(value)

  if (kind === 'boolean')
    return typeof value === 'boolean'

  if (kind === 'collections')
    return Array.isArray(value) && value.every(item => typeof item === 'string')

  return typeof value === 'string'
}

function optionKinds(type: FieldType): Record<string, FieldOptionType> {
  const options = Object.entries(fieldTypes[type].options).map(([option, spec]) => [option, spec.type] as const)

  return { ...BASE_OPTIONS, ...Object.fromEntries(options) }
}

function checkLocales(report: Report, locales: unknown): readonly unknown[] {
  if (locales === undefined)
    return []

  if (!Array.isArray(locales)) {
    report(['locales'], '"locales" has to be a list of locale codes')

    return []
  }

  locales.forEach((locale, index) => {
    if (typeof locale !== 'string' || !LOCALE_CODE.test(locale))
      report(['locales', index], `${quote(locale)} is not a locale code`)
    else if (locales.indexOf(locale) < index)
      report(['locales', index], `Locale ${quote(locale)} is listed twice`)
  })

  return locales
}

function checkReferences(context: Context, path: ValuePath, label: string, targets: readonly string[], listed: boolean): void {
  targets.forEach((target, index) => {
    const at = listed ? [...path, index] : path

    if (!context.collections.has(target))
      context.report(at, `Field ${quote(label)} references unknown collection ${quote(target)}`)
    else if (targets.indexOf(target) < index)
      context.report(at, `Field ${quote(label)} lists collection ${quote(target)} twice`)
  })
}

function checkOption(context: Context, path: ValuePath, label: string, option: string, kind: FieldOptionType, value: unknown): void {
  if (!fits(kind, value))
    context.report(path, `${quote(option)} of field ${quote(label)} has to be ${KINDS[kind]}`)
  else if (kind === 'collection' || kind === 'collections')
    checkReferences(context, path, label, kind === 'collection' ? [value as string] : value as string[], kind === 'collections')
}

function checkConstraints(report: Report, path: ValuePath, label: string, field: Record<string, unknown>): void {
  if (field.type === 'text' && typeof field.validation === 'string') {
    const pattern = compilePattern(field.validation)

    if (pattern instanceof SyntaxError)
      report([...path, 'validation'], `"validation" of field ${quote(label)} is not a valid regular expression: ${pattern.message.replace(/^Invalid regular expression: /, '')}`)
  }

  if (field.type !== 'number')
    return

  if (finite(field.step) && field.step <= 0)
    report([...path, 'step'], `"step" of field ${quote(label)} has to be greater than 0`)

  if (finite(field.min) && finite(field.max) && field.min > field.max)
    report([...path, 'min'], `"min" of field ${quote(label)} can't be greater than "max"`)
}

function checkField(context: Context, path: ValuePath, collection: string, key: string, field: unknown): void {
  const { report } = context
  const label = `${collection}.${key}`

  if (RESERVED_FIELDS.includes(key))
    report(path, `Field ${quote(label)} uses ${quote(key)}, which is reserved for entry metadata`)

  if (!isRecord(field))
    return report(path, `Field ${quote(label)} has to be an object`)

  if (field.type === undefined)
    return report(path, `Field ${quote(label)} needs a type`)

  if (!isFieldType(field.type))
    return report([...path, 'type'], `Field ${quote(label)} has unknown type ${quote(field.type)}; use one of ${fieldTypeNames.join(', ')}`)

  const kinds = optionKinds(field.type)

  for (const [option, value] of Object.entries(field)) {
    const kind = kinds[option]

    if (option === 'type')
      continue

    if (kind)
      checkOption(context, [...path, option], label, option, kind, value)
    else
      report([...path, option], `Field ${quote(label)} has no option ${quote(option)}`)
  }

  for (const [option, spec] of Object.entries(fieldTypes[field.type].options)) {
    if ('required' in spec && field[option] === undefined)
      report(path, `Field ${quote(label)} needs ${quote(option)}`)
  }

  checkConstraints(report, path, label, field)

  if (field.translate === true && context.locales.length === 0)
    report([...path, 'translate'], `Field ${quote(label)} is translated, but the schema has no locales`)
}

function checkCollection(context: Context, name: string, collection: unknown): void {
  const { report } = context
  const path = ['collections', name]

  if (!COLLECTION_NAME.test(name))
    report(path, `Collection ${quote(name)} has to start with a lowercase letter and contain only letters and digits`)

  if (!isRecord(collection))
    return report(path, `Collection ${quote(name)} has to be an object`)

  for (const [key, value] of Object.entries(collection)) {
    if (!COLLECTION_KEYS.has(key))
      report([...path, key], `Collection ${quote(name)} has no option ${quote(key)}`)
    else if (key !== 'fields' && typeof value !== 'string')
      report([...path, key], `${quote(key)} of collection ${quote(name)} has to be a string`)
  }

  if (!isRecord(collection.fields))
    return report(collection.fields === undefined ? path : [...path, 'fields'], `Collection ${quote(name)} needs "fields" as an object`)

  for (const [key, field] of Object.entries(collection.fields))
    checkField(context, [...path, 'fields', key], name, key, field)
}

export function validateSchema(schema: unknown): ValueIssue[] {
  const issues: ValueIssue[] = []
  const report: Report = (path, message) => issues.push({ path, message })

  if (!isRecord(schema)) {
    report([], 'The schema has to be an object')

    return issues
  }

  for (const key of Object.keys(schema)) {
    if (!SCHEMA_KEYS.has(key))
      report([key], `The schema has no option ${quote(key)}`)
  }

  const locales = checkLocales(report, schema.locales)

  if (!isRecord(schema.collections)) {
    report(schema.collections === undefined ? [] : ['collections'], 'The schema needs "collections" as an object')

    return issues
  }

  const context: Context = { report, collections: new Set(Object.keys(schema.collections)), locales }

  for (const [name, collection] of Object.entries(schema.collections))
    checkCollection(context, name, collection)

  return issues
}
