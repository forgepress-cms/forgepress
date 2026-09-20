import { isRecord } from '../../utils/value'

export const COLLECTION_KEY = 'collection'

export const COMPONENT_KEY = 'component'

export interface EntryRef<TCollectionName extends string = string> {
  collection: TCollectionName
  id: string
}

export type ComponentItem = Record<string, unknown>

export type Listed<TField, TItem> = TField extends { multiple: true } ? TItem[] : TItem

export type Picked<TNames extends readonly string[], TOne, TMany> = TNames extends readonly [string] ? TOne : TMany

export type Named<TField> = TField extends { collections: readonly string[] }
  ? TField['collections']
  : TField extends { components: readonly string[] } ? TField['components'] : readonly string[]

export function onlyName(names: readonly string[] | undefined): string | undefined {
  return names?.length === 1 ? names[0] : undefined
}

export function taggedName(names: readonly string[] | undefined, key: string, item: unknown): string | undefined {
  const only = onlyName(names)

  if (only !== undefined)
    return only

  const tag = isRecord(item) ? item[key] : undefined

  return typeof tag === 'string' ? tag : undefined
}

export function items(value: unknown, multiple: boolean | undefined): unknown[] {
  if (!multiple)
    return [value]

  return Array.isArray(value) ? value : []
}

export function mapItems(value: unknown, multiple: boolean | undefined, item: (value: unknown) => unknown): unknown {
  if (!multiple)
    return item(value)

  return Array.isArray(value) ? value.map(item) : value
}
