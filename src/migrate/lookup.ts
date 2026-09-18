import type { Entry } from '../entries/types'
import type { Collection } from '../schema/types'
import { isRecord } from '../utils/value'

export function titleKey(collection: Collection | undefined): string | undefined {
  const fields = Object.entries(collection?.fields ?? {})

  return (fields.find(([, field]) => field.type === 'text') ?? fields.find(([, field]) => field.type === 'richtext'))?.[0]
}

export function textOf(value: unknown, locales: readonly string[]): string | undefined {
  const candidates = isRecord(value) ? [...locales.map(locale => value[locale]), ...Object.values(value)] : [value]
  const found = candidates.find(item => typeof item === 'string' && item.trim() !== '')

  return typeof found === 'string' ? found : undefined
}

export function entryTitle(entry: Entry, collection: Collection | undefined, locales: readonly string[]): string {
  const key = titleKey(collection)
  const text = key === undefined ? undefined : textOf(entry[key], locales)

  return text?.split('\n').find(line => line.trim() !== '')?.trim() ?? entry.id
}

export function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}
