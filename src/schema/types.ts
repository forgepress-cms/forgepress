import type { Field } from './fields/registry'

export interface ComponentDefinition {
  label?: string
  description?: string
  fields: Record<string, Field>
}

export type PreviewAddress = string | Readonly<Record<string, string>>

export interface CollectionDefinition extends ComponentDefinition {
  preview?: PreviewAddress
  single?: boolean
}

export interface Schema {
  components?: Record<string, ComponentDefinition>
  collections: Record<string, CollectionDefinition>
  locales?: readonly string[]
  defaultLocale?: string
}

export type SchemaLocale<TSchema extends Schema>
  = TSchema['locales'] extends readonly string[] ? TSchema['locales'][number] : never

export interface SchemaRegistry {}

export type RegisteredSchema = SchemaRegistry extends { schema: infer TSchema extends Schema }
  ? TSchema
  : Schema
