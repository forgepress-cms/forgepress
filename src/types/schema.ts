import type { Field } from '../schema/fields'

export interface Collection {
  label?: string
  description?: string
  fields: Record<string, Field>
}

export interface ForgePressSchema {
  collections: Record<string, Collection>
  locales?: readonly string[]
}

export type SchemaLocale<TSchema extends ForgePressSchema>
  = TSchema['locales'] extends readonly string[] ? TSchema['locales'][number] : never

export interface ForgePressSchemaRegistry {}

export type RegisteredSchema = ForgePressSchemaRegistry extends { schema: infer TSchema extends ForgePressSchema }
  ? TSchema
  : ForgePressSchema
