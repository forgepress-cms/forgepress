import type { Entry } from '../entries/types'
import type { ForgePressSchema } from '../schema/types'
import type { Content, RenameQuestion, Renames } from './types'
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

function empty(rows: readonly Record<string, unknown>[], key: string): boolean {
  return rows.every(row => leaves(row[key]) === 0)
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
