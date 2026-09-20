import type { Entry } from '../entries/types'
import type { Field } from '../schema/fields'
import type { ForgePressSchema } from '../schema/types'
import type { Content, RenameQuestion, Renames } from './types'
import { componentItems } from '../entries/items'
import { META_KEYS } from '../entries/meta'
import { isTranslated } from '../schema/fields'
import { isTranslations } from './convert'
import { invert, leaves } from './plan'

export interface QuestionInput {
  before: ForgePressSchema
  after: ForgePressSchema
  content: Content
  renames?: Renames | undefined
  repair?: boolean | undefined
}

const META: ReadonlySet<string> = new Set(META_KEYS)

type Row = Record<string, unknown>

function empty(rows: readonly Row[], key: string): boolean {
  return rows.every(row => leaves(row[key]) === 0)
}

function collectItems(schema: ForgePressSchema, field: Field | undefined, value: unknown, translated: boolean, found: Map<string, Row[]>): void {
  if (!field || field.type !== 'component')
    return

  for (const { name, item } of componentItems(field, value, translated)) {
    const definition = schema.components?.[name]

    if (!definition)
      continue

    found.set(name, [...found.get(name) ?? [], item])

    for (const [key, inner] of Object.entries(definition.fields))
      collectItems(schema, inner, item[key], isTranslated(inner, schema.locales ?? []), found)
  }
}

function itemsByComponent(schema: ForgePressSchema, content: Content): Map<string, Row[]> {
  const found = new Map<string, Row[]>()

  for (const [collection, definition] of Object.entries(schema.collections)) {
    for (const row of content[collection] ?? []) {
      for (const [key, field] of Object.entries(definition.fields))
        collectItems(schema, field, row[key], isTranslated(field, schema.locales ?? []), found)
    }
  }

  return found
}

function componentQuestions(before: ForgePressSchema, after: ForgePressSchema, content: Content, renames: Renames): RenameQuestion[] {
  const questions: RenameQuestion[] = []
  const items = itemsByComponent(before, content)
  const componentRenames = renames.components ?? {}
  const componentSources = invert(componentRenames)
  const takenComponents = new Set(Object.values(componentRenames))
  const previous = before.components ?? {}
  const current = after.components ?? {}

  for (const from of Object.keys(previous)) {
    if (from in componentRenames || current[from] || (items.get(from) ?? []).length === 0)
      continue

    const to = Object.keys(current).filter(name => !takenComponents.has(name) && !previous[name])

    if (to.length > 0)
      questions.push({ kind: 'component', from, to })
  }

  for (const [target, definition] of Object.entries(current)) {
    const source = componentSources[target] ?? target
    const fields = previous[source]?.fields

    if (!fields)
      continue

    const fieldRenames = renames.componentFields?.[target] ?? {}
    const taken = new Set(Object.values(fieldRenames))
    const rows = items.get(source) ?? []

    for (const from of Object.keys(fields)) {
      if (from in fieldRenames || definition.fields[from])
        continue

      const holders = rows.filter(row => leaves(row[from]) > 0)
      const to = Object.keys(definition.fields).filter(key => !taken.has(key) && !(key in fieldRenames) && empty(holders, key))

      if (holders.length > 0 && to.length > 0)
        questions.push({ kind: 'field', component: target, from, to })
    }
  }

  return questions
}

export function renameQuestions({ before, after, content, renames = {}, repair = false }: QuestionInput): RenameQuestion[] {
  const questions: RenameQuestion[] = []
  const rows = (name: string): readonly Entry[] => content[name] ?? []
  const sources = [...new Set([...Object.keys(before.collections), ...repair ? Object.keys(content) : []])]
  const collectionRenames = renames.collections ?? {}
  const collectionSources = invert(collectionRenames)
  const takenCollections = new Set(Object.values(collectionRenames))

  for (const from of sources) {
    if (from in collectionRenames || after.collections[from] || rows(from).length === 0)
      continue

    const to = Object.keys(after.collections).filter(name => !takenCollections.has(name) && rows(name).length === 0 && (repair || !before.collections[name]))

    if (to.length > 0)
      questions.push({ kind: 'collection', from, to })
  }

  questions.push(...componentQuestions(before, after, content, renames))

  const records: Record<string, unknown>[] = []

  for (const [target, definition] of Object.entries(after.collections)) {
    const source = collectionSources[target] ?? target

    if (!sources.includes(source))
      continue

    const entries = rows(source)
    const previous = before.collections[source]?.fields ?? {}
    const fieldRenames = renames.fields?.[target] ?? {}
    const fieldSources = invert(fieldRenames)
    const taken = new Set(Object.values(fieldRenames))
    const keys = [...new Set([...Object.keys(previous), ...repair ? entries.flatMap(row => Object.keys(row)).filter(key => !META.has(key)) : []])]

    for (const from of keys) {
      if (from in fieldRenames || definition.fields[from])
        continue

      const holders = entries.filter(row => leaves(row[from]) > 0)
      const to = Object.keys(definition.fields).filter(key => !taken.has(key) && !(key in fieldRenames) && empty(holders, key))

      if (holders.length > 0 && to.length > 0)
        questions.push({ kind: 'field', collection: target, from, to })
    }

    for (const row of entries) {
      for (const [key, value] of Object.entries(row)) {
        const field = definition.fields[fieldRenames[key] ?? key]
        const was = previous[fieldSources[key] ?? key] ?? previous[key]
        const translated = (field && isTranslated(field, after.locales ?? [])) || (was && isTranslated(was, before.locales ?? []))

        if (!META.has(key) && translated && isTranslations(value))
          records.push(value)
      }
    }
  }

  const localeRenames = renames.locales ?? {}
  const takenLocales = new Set(Object.values(localeRenames))
  const afterLocales = after.locales ?? []
  const found = repair ? records.flatMap(record => Object.keys(record)) : []

  for (const from of new Set([...before.locales ?? [], ...found])) {
    if (from in localeRenames || afterLocales.includes(from))
      continue

    const holders = records.filter(record => leaves(record[from]) > 0)
    const to = afterLocales.filter(locale => !takenLocales.has(locale) && !(locale in localeRenames) && empty(holders, locale))

    if (holders.length > 0 && to.length > 0)
      questions.push({ kind: 'locale', from, to })
  }

  return questions
}
