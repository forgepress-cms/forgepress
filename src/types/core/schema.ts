import type { Collection } from './collection'

export interface ForgePressSchema {
  collections: Record<string, Collection>
  locales?: readonly string[]
}

export type SchemaLocale<TSchema extends ForgePressSchema>
  = TSchema['locales'] extends readonly string[] ? TSchema['locales'][number] : never
