import type { Entry } from '../entries'
import type { CollectionDefinition, Field, Schema } from '../schema'
import type { Entries, RenameQuestion, Renames } from './types'
import { componentItems } from '../entries'
import { isTranslated, META_KEYS } from '../schema'
import { isTranslations } from './convert'
import { invert, leaves } from './plan'

export interface QuestionInput {
  before: Schema
  after: Schema
  content: Entries
  renames?: Renames | undefined
  repair?: boolean | undefined
}

const META: ReadonlySet<string> = new Set(META_KEYS)

type Row = Record<string, unknown>

function empty(rows: readonly Row[], key: string): boolean {
  return rows.every(row => leaves(row[key]) === 0)
}

function collectItems(schema: Schema, field: Field | undefined, value: unknown, translated: boolean, found: Map<string, Row[]>): void {
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

function itemsByComponent(schema: Schema, content: Entries): Map<string, Row[]> {
  const found = new Map<string, Row[]>()

  for (const [collection, definition] of Object.entries(schema.collections)) {
    for (const row of content[collection] ?? []) {
      for (const [key, field] of Object.entries(definition.fields))
        collectItems(schema, field, row[key], isTranslated(field, schema.locales ?? []), found)
    }
  }

  return found
}

function componentNameQuestions(before: Schema, after: Schema, items: Map<string, Row[]>, renames: Renames): RenameQuestion[] {
  const questions: RenameQuestion[] = []
  const componentRenames = renames.components ?? {}
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

  return questions
}

function componentFieldQuestions(before: Schema, after: Schema, items: Map<string, Row[]>, renames: Renames): RenameQuestion[] {
  const questions: RenameQuestion[] = []
  const componentSources = invert(renames.components ?? {})
  const previous = before.components ?? {}

  for (const [target, definition] of Object.entries(after.components ?? {})) {
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

function componentQuestions(before: Schema, after: Schema, content: Entries, renames: Renames): RenameQuestion[] {
  const items = itemsByComponent(before, content)

  return [...componentNameQuestions(before, after, items, renames), ...componentFieldQuestions(before, after, items, renames)]
}

function collectionQuestions(before: Schema, after: Schema, content: Entries, sources: readonly string[], renames: Renames, repair: boolean): RenameQuestion[] {
  const questions: RenameQuestion[] = []
  const rows = (name: string): readonly Entry[] => content[name] ?? []
  const collectionRenames = renames.collections ?? {}
  const takenCollections = new Set(Object.values(collectionRenames))

  for (const from of sources) {
    if (from in collectionRenames || after.collections[from] || rows(from).length === 0)
      continue

    const to = Object.keys(after.collections).filter(name => !takenCollections.has(name) && rows(name).length === 0 && (repair || !before.collections[name]))

    if (to.length > 0)
      questions.push({ kind: 'collection', from, to })
  }

  return questions
}

function fieldQuestions(target: string, definition: CollectionDefinition, previous: Readonly<Record<string, Field>>, entries: readonly Entry[], fieldRenames: Readonly<Record<string, string>>, repair: boolean): RenameQuestion[] {
  const questions: RenameQuestion[] = []
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

  return questions
}

function translationRecords(before: Schema, after: Schema, definition: CollectionDefinition, previous: Readonly<Record<string, Field>>, entries: readonly Entry[], fieldRenames: Readonly<Record<string, string>>): Row[] {
  const records: Row[] = []
  const fieldSources = invert(fieldRenames)

  for (const row of entries) {
    for (const [key, value] of Object.entries(row)) {
      const field = definition.fields[fieldRenames[key] ?? key]
      const was = previous[fieldSources[key] ?? key] ?? previous[key]
      const translated = (field && isTranslated(field, after.locales ?? [])) || (was && isTranslated(was, before.locales ?? []))

      if (!META.has(key) && translated && isTranslations(value))
        records.push(value)
    }
  }

  return records
}

function localeQuestions(before: Schema, after: Schema, records: readonly Row[], renames: Renames, repair: boolean): RenameQuestion[] {
  const questions: RenameQuestion[] = []
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

export function renameQuestions({ before, after, content, renames = {}, repair = false }: QuestionInput): RenameQuestion[] {
  const sources = [...new Set([...Object.keys(before.collections), ...repair ? Object.keys(content) : []])]
  const collectionSources = invert(renames.collections ?? {})
  const questions = [...collectionQuestions(before, after, content, sources, renames, repair), ...componentQuestions(before, after, content, renames)]
  const records: Row[] = []

  for (const [target, definition] of Object.entries(after.collections)) {
    const source = collectionSources[target] ?? target

    if (!sources.includes(source))
      continue

    const entries = content[source] ?? []
    const previous = before.collections[source]?.fields ?? {}
    const fieldRenames = renames.fields?.[target] ?? {}

    questions.push(...fieldQuestions(target, definition, previous, entries, fieldRenames, repair))
    records.push(...translationRecords(before, after, definition, previous, entries, fieldRenames))
  }

  return [...questions, ...localeQuestions(before, after, records, renames, repair)]
}
