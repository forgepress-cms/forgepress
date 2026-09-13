import type { Field, FieldContent } from '../../fields'
import type { RegisteredSchema } from '../query'
import type { Collection } from './collection'
import type { EntryMeta } from './entry'
import type { ForgePressSchema, SchemaLocale } from './schema'

type Translated<TSchema extends ForgePressSchema, TContent>
  = [SchemaLocale<TSchema>] extends [never] ? TContent : Record<SchemaLocale<TSchema>, TContent>

type PartiallyTranslated<TSchema extends ForgePressSchema, TContent>
  = [SchemaLocale<TSchema>] extends [never] ? TContent : Partial<Record<SchemaLocale<TSchema>, TContent>>

type FieldValue<
  TSchema extends ForgePressSchema,
  TField extends Field,
  TOptional extends boolean,
> = TField extends { translate: true }
  ? TOptional extends true
    ? PartiallyTranslated<TSchema, FieldContent<TField>>
    : Translated<TSchema, FieldContent<TField>>
  : FieldContent<TField>

type OptionalKeys<TCollection extends Collection> = {
  [TKey in keyof TCollection['fields']]-?:
  TCollection['fields'][TKey] extends { optional: true } ? TKey : never
}[keyof TCollection['fields']]

type RequiredKeys<TCollection extends Collection> = Exclude<keyof TCollection['fields'], OptionalKeys<TCollection>>

type CollectionContent<TSchema extends ForgePressSchema, TCollection extends Collection> = EntryMeta & {
  [TKey in RequiredKeys<TCollection>]: FieldValue<TSchema, TCollection['fields'][TKey], false>
} & {
  [TKey in OptionalKeys<TCollection>]?: FieldValue<TSchema, TCollection['fields'][TKey], true>
}

export type EntryOf<
  TSchema extends ForgePressSchema,
  TCollectionName extends keyof TSchema['collections'],
> = CollectionContent<TSchema, TSchema['collections'][TCollectionName]>

export type ForgePressEntry<TCollectionName extends keyof RegisteredSchema['collections']>
  = EntryOf<RegisteredSchema, TCollectionName>

export type ForgePressContent<TCollectionName extends keyof RegisteredSchema['collections']>
  = EntryOf<RegisteredSchema, TCollectionName>[]
