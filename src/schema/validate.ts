import type { ValueIssue, ValuePath } from '../files/issues'
import type { FieldBase, FieldOptionType, FieldTypeDefinition } from './fields/types'
import { META_KEYS } from '../entries/meta'
import { isCollectionName } from '../files/paths'
import { isRecord, quote } from '../utils/value'
import { fieldTypeNames, fieldTypes } from './fields'
import { COMPONENT_KEY } from './fields/picked'
import { compilePattern } from './fields/text'

export const LOCALE_CODE = /^[a-z][\w-]*$/i
export const RESERVED_FIELDS: readonly string[] = META_KEYS

type FieldType = keyof typeof fieldTypes

type Report = (path: ValuePath, message: string) => void

interface Context {
  report: Report
  collections: ReadonlySet<string>
  components: ReadonlySet<string>
  locales: readonly unknown[]
  nested: boolean
  translating: ReadonlySet<string>
}

type Group = 'collections' | 'components'

const GROUP_NAMES: Record<Group, string> = { collections: 'Collection', components: 'Component' }

const SCHEMA_KEYS = new Set(['components', 'collections', 'locales', 'defaultLocale'])
const COLLECTION_KEYS = new Set(['label', 'description', 'fields'])

export const BASE_OPTIONS: Record<keyof FieldBase, FieldOptionType> = {
  label: 'text',
  description: 'text',
  optional: 'boolean',
  translate: 'boolean',
}

const INDEXABLE = fieldTypeNames.filter(type => 'index' in fieldTypes[type].options)

const KINDS: Record<FieldOptionType, string> = {
  text: 'a string',
  number: 'a number',
  boolean: 'true or false',
  collections: 'a list of collection names',
  components: 'a list of component names',
  strings: 'a list of strings',
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

  if (kind === 'collections' || kind === 'components' || kind === 'strings')
    return Array.isArray(value) && value.every(item => typeof item === 'string')

  return typeof value === 'string'
}

function optionKinds(type: FieldType): Record<string, FieldOptionType> {
  const options = Object.entries(fieldTypes[type].options).map(([option, spec]) => [option, spec.type] as const)

  const base = Object.entries(BASE_OPTIONS).filter(([option]) => !(fieldTypes[type] as FieldTypeDefinition).without?.includes(option as keyof FieldBase))

  return { ...Object.fromEntries(base), ...Object.fromEntries(options) }
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

function checkDefaultLocale(report: Report, chosen: unknown, locales: readonly unknown[]): void {
  if (chosen === undefined)
    return

  if (typeof chosen !== 'string')
    report(['defaultLocale'], '"defaultLocale" has to be a locale code')
  else if (!locales.includes(chosen))
    report(['defaultLocale'], `The default locale ${quote(chosen)} is not in "locales"`)
}

function checkReferences(context: Context, path: ValuePath, label: string, targets: readonly string[], group: 'collections' | 'components'): void {
  const known = group === 'collections' ? context.collections : context.components
  const noun = group === 'collections' ? 'collection' : 'component'

  if (targets.length === 0)
    context.report(path, `Field ${quote(label)} needs at least one ${noun}`)

  targets.forEach((target, index) => {
    const at = [...path, index]

    if (!known.has(target))
      context.report(at, `Field ${quote(label)} references unknown ${noun} ${quote(target)}`)
    else if (targets.indexOf(target) < index)
      context.report(at, `Field ${quote(label)} lists ${noun} ${quote(target)} twice`)
  })
}

function checkOption(context: Context, path: ValuePath, label: string, option: string, kind: FieldOptionType, value: unknown): void {
  if (!fits(kind, value))
    context.report(path, `${quote(option)} of field ${quote(label)} has to be ${KINDS[kind]}`)
  else if (kind === 'collections' || kind === 'components')
    checkReferences(context, path, label, value as string[], kind)
}

function checkConstraints(report: Report, path: ValuePath, label: string, field: Record<string, unknown>): void {
  if (field.type === 'text' && typeof field.validation === 'string') {
    const pattern = compilePattern(field.validation)

    if (pattern instanceof SyntaxError)
      report([...path, 'validation'], `"validation" of field ${quote(label)} is not a valid regular expression: ${pattern.message.replace(/^Invalid regular expression: /, '')}`)
  }

  if (field.type === 'list' && Array.isArray(field.values)) {
    const values: unknown[] = field.values

    values.forEach((value, index) => {
      if (values.indexOf(value) < index)
        report([...path, 'values', index], `Field ${quote(label)} lists the value ${quote(value)} twice`)
    })
  }

  if (field.type !== 'number')
    return

  if (finite(field.step) && field.step <= 0)
    report([...path, 'step'], `"step" of field ${quote(label)} has to be greater than 0`)

  if (finite(field.min) && finite(field.max) && field.min > field.max)
    report([...path, 'min'], `"min" of field ${quote(label)} can't be greater than "max"`)
}

function checkNestedTranslations(context: Context, path: ValuePath, label: string, names: unknown): void {
  const translated = (Array.isArray(names) ? names : []).filter(name => typeof name === 'string' && context.translating.has(name))

  if (translated.length > 0)
    context.report(path, `Field ${quote(label)} is translated, and so ${translated.length === 1 ? 'is component' : 'are the components'} ${translated.map(quote).join(', ')}; translate one or the other`)
}

function checkField(context: Context, path: ValuePath, owner: string, key: string, field: unknown): void {
  const { report } = context
  const label = `${owner}.${key}`

  if (RESERVED_FIELDS.includes(key))
    report(path, `Field ${quote(label)} uses ${quote(key)}, which is reserved for entry metadata`)

  if (context.nested && key === COMPONENT_KEY)
    report(path, `Field ${quote(label)} uses ${quote(COMPONENT_KEY)}, which is reserved for the component an item holds`)

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

    if (context.nested && option === 'index')
      report([...path, option], `Field ${quote(label)} is inside a component and can't be indexed`)
    else if (option === 'translate' && value === true && field.type === 'component')
      checkNestedTranslations(context, [...path, option], label, field.components)
    else if (kind)
      checkOption(context, [...path, option], label, option, kind, value)
    else if (option === 'index')
      report([...path, option], `Field ${quote(label)} can't be indexed; only ${INDEXABLE.slice(0, -1).join(', ')} and ${INDEXABLE.at(-1)} fields can`)
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

function checkGroup(context: Context, group: Group, name: string, value: unknown): void {
  const { report } = context
  const path = [group, name]
  const noun = GROUP_NAMES[group]

  if (!isCollectionName(name))
    report(path, `${noun} ${quote(name)} has to start with a lowercase letter and contain only letters and digits`)

  if (!isRecord(value))
    return report(path, `${noun} ${quote(name)} has to be an object`)

  for (const [key, option] of Object.entries(value)) {
    if (!COLLECTION_KEYS.has(key))
      report([...path, key], `${noun} ${quote(name)} has no option ${quote(key)}`)
    else if (key !== 'fields' && typeof option !== 'string')
      report([...path, key], `${quote(key)} of ${noun.toLowerCase()} ${quote(name)} has to be a string`)
  }

  if (!isRecord(value.fields))
    return report(value.fields === undefined ? path : [...path, 'fields'], `${noun} ${quote(name)} needs "fields" as an object`)

  for (const [key, field] of Object.entries(value.fields))
    checkField(context, [...path, 'fields', key], name, key, field)
}

function includedComponents(component: unknown): string[] {
  if (!isRecord(component) || !isRecord(component.fields))
    return []

  return Object.values(component.fields).flatMap(field => isRecord(field) && field.type === 'component' && Array.isArray(field.components)
    ? field.components.filter(name => typeof name === 'string')
    : [])
}

function translatingComponents(components: Record<string, unknown>): Set<string> {
  const found = new Set<string>()
  const fieldsOf = (name: string): Record<string, unknown> => {
    const component = components[name]

    return isRecord(component) && isRecord(component.fields) ? component.fields : {}
  }

  const translates = (name: string, trail: readonly string[]): boolean => {
    if (trail.includes(name))
      return false

    return Object.values(fieldsOf(name)).some((field) => {
      if (!isRecord(field))
        return false

      if (field.translate === true)
        return true

      return field.type === 'component' && (Array.isArray(field.components) ? field.components : [])
        .some(inner => typeof inner === 'string' && translates(inner, [...trail, name]))
    })
  }

  for (const name of Object.keys(components)) {
    if (translates(name, []))
      found.add(name)
  }

  return found
}

function checkCycles(report: Report, components: Record<string, unknown>): void {
  const reported = new Set<string>()

  const visit = (name: string, trail: string[]): void => {
    if (trail.includes(name)) {
      const cycle = trail.slice(trail.indexOf(name))

      if (!cycle.some(item => reported.has(item))) {
        cycle.forEach(item => reported.add(item))
        report(['components', name], `Component ${quote(name)} includes itself through ${[...cycle, name].join(' → ')}`)
      }

      return
    }

    for (const next of includedComponents(components[name]))
      visit(next, [...trail, name])
  }

  for (const name of Object.keys(components))
    visit(name, [])
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

  checkDefaultLocale(report, schema.defaultLocale, locales)

  if (!isRecord(schema.collections)) {
    report(schema.collections === undefined ? [] : ['collections'], 'The schema needs "collections" as an object')

    return issues
  }

  const components = schema.components === undefined ? {} : schema.components

  if (!isRecord(components))
    report(['components'], '"components" has to be an object')

  const found = isRecord(components) ? components : {}
  const context: Context = { report, collections: new Set(Object.keys(schema.collections)), components: new Set(Object.keys(found)), locales, nested: false, translating: translatingComponents(found) }

  for (const [name, component] of Object.entries(found))
    checkGroup({ ...context, nested: true }, 'components', name, component)

  checkCycles(report, found)

  for (const [name, collection] of Object.entries(schema.collections))
    checkGroup(context, 'collections', name, collection)

  return issues
}
