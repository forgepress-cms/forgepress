import type { Field, FieldContent } from '../schema/fields'
import type { CollectionField } from '../schema/fields/collection'
import type { ComponentField } from '../schema/fields/component'
import type { EntryRef, Listed, Picked } from '../schema/fields/picked'
import type { Collection, Component, ForgePressSchema, RegisteredSchema, SchemaLocale } from '../schema/types'

export type { EntryRef }

export type EntryStatus = 'published' | 'unpublished'

export interface EntryMeta {
  id: string
  status: EntryStatus
  createdAt: string
  updatedAt: string
}

export interface OutputMeta {
  id: string
  createdAt: string
  updatedAt: string
}

export type Entry = EntryMeta & {
  [field: string]: unknown
}

type Translated<TSchema extends ForgePressSchema, TContent>
  = [SchemaLocale<TSchema>] extends [never] ? TContent : Record<SchemaLocale<TSchema>, TContent>

type PartiallyTranslated<TSchema extends ForgePressSchema, TContent>
  = [SchemaLocale<TSchema>] extends [never] ? TContent : Partial<Record<SchemaLocale<TSchema>, TContent>>

type Fields = Record<string, Field>

type OptionalKeys<TFields extends Fields> = {
  [TKey in keyof TFields]-?: TFields[TKey] extends { optional: true } ? TKey : never
}[keyof TFields]

type RequiredKeys<TFields extends Fields> = Exclude<keyof TFields, OptionalKeys<TFields>>

export type ComponentFields<TSchema extends ForgePressSchema, TName> = TSchema['components'] extends Record<string, Component>
  ? TName extends keyof TSchema['components'] ? TSchema['components'][TName]['fields'] : Fields
  : Fields

export type PathHead<TPath extends string> = TPath extends `${infer THead}.${string}` ? THead : TPath

export type PathTail<TPath extends string> = TPath extends `${string}.${infer TRest}` ? TRest : ''

type Shape = 'content' | 'output' | 'linked'

type Held<TSchema extends ForgePressSchema, TFields extends Fields, TKey extends keyof TFields, TOptional extends boolean, TShape extends Shape, TPath extends string>
  = TKey extends PathHead<TPath>
    ? FieldValue<TSchema, TFields[TKey], TOptional, 'linked', PathTail<TPath>>
    : FieldValue<TSchema, TFields[TKey], TOptional, TShape, ''>

type Item<TSchema extends ForgePressSchema, TFields extends Fields, TShape extends Shape, TPath extends string = ''> = {
  [TKey in RequiredKeys<TFields>]: Held<TSchema, TFields, TKey, false, TShape, TPath>
} & {
  [TKey in OptionalKeys<TFields>]?: Held<TSchema, TFields, TKey, true, TShape, TPath>
}

type TaggedItem<TSchema extends ForgePressSchema, TNames extends string, TShape extends Shape, TPath extends string> = TNames extends string
  ? { component: TNames } & Item<TSchema, ComponentFields<TSchema, TNames>, TShape, TPath>
  : never

type Items<TSchema extends ForgePressSchema, TField extends ComponentField, TShape extends Shape, TPath extends string> = Listed<TField, Picked<
  TField['components'],
  Item<TSchema, ComponentFields<TSchema, TField['components'][number]>, TShape, TPath>,
  TaggedItem<TSchema, TField['components'][number], TShape, TPath>
>>

export type LinkedBlock<TSchema extends ForgePressSchema, TTarget, TPath extends string = ''> = TTarget extends keyof TSchema['collections']
  ? { collection: TTarget, id: string, entry: OutputOf<TSchema, TTarget, TPath> }
  : never

type LinkedEntries<TSchema extends ForgePressSchema, TField extends CollectionField, TPath extends string> = Listed<TField, Picked<
  TField['collections'],
  OutputOf<TSchema, TField['collections'][number] & keyof TSchema['collections'], TPath>,
  LinkedBlock<TSchema, TField['collections'][number], TPath>
>>

type Value<TSchema extends ForgePressSchema, TField extends Field, TShape extends Shape, TPath extends string> = TField extends ComponentField
  ? Items<TSchema, TField, TShape, TPath>
  : TField extends CollectionField
    ? TShape extends 'content'
      ? FieldContent<TField>
      : TShape extends 'output' ? Listed<TField, EntryRef<TField['collections'][number]>> : LinkedEntries<TSchema, TField, TPath>
    : FieldContent<TField>

export type LinkedValue<TSchema extends ForgePressSchema, TField extends Field, TPath extends string = ''> = Value<TSchema, TField, 'linked', TPath>

type FieldValue<
  TSchema extends ForgePressSchema,
  TField extends Field,
  TOptional extends boolean,
  TShape extends Shape,
  TPath extends string,
> = TShape extends 'content'
  ? TField extends { translate: true }
    ? TOptional extends true
      ? PartiallyTranslated<TSchema, Value<TSchema, TField, TShape, TPath>>
      : Translated<TSchema, Value<TSchema, TField, TShape, TPath>>
    : Value<TSchema, TField, TShape, TPath>
  : Value<TSchema, TField, TShape, TPath>

type CollectionContent<TSchema extends ForgePressSchema, TCollection extends Collection> = EntryMeta & Item<TSchema, TCollection['fields'], 'content'>

export type EntryOf<
  TSchema extends ForgePressSchema,
  TCollectionName extends keyof TSchema['collections'],
> = CollectionContent<TSchema, TSchema['collections'][TCollectionName]>

export type ForgePressEntry<TCollectionName extends keyof RegisteredSchema['collections']>
  = EntryOf<RegisteredSchema, TCollectionName>

type CollectionOutput<TSchema extends ForgePressSchema, TCollection extends Collection, TPath extends string> = OutputMeta & Item<TSchema, TCollection['fields'], 'output', TPath>

export type OutputOf<
  TSchema extends ForgePressSchema,
  TCollectionName extends keyof TSchema['collections'],
  TPath extends string = '',
> = CollectionOutput<TSchema, TSchema['collections'][TCollectionName], TPath>

export type ForgePressOutput<TCollectionName extends keyof RegisteredSchema['collections']>
  = OutputOf<RegisteredSchema, TCollectionName>
