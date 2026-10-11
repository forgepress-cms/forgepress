import type { OutputEntry } from '../output/types'
import type { Field, FieldContent } from '../schema/fields'
import type { CollectionField } from '../schema/fields/collection'
import type { ComponentField } from '../schema/fields/component'
import type { ComponentItem, EntryRef, Listed, Picked } from '../schema/fields/picked'
import type { CollectionDefinition, ComponentDefinition, RegisteredSchema, Schema, SchemaLocale } from '../schema/types'

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

type Translated<TSchema extends Schema, TContent>
  = [SchemaLocale<TSchema>] extends [never] ? TContent : Record<SchemaLocale<TSchema>, TContent>

type PartiallyTranslated<TSchema extends Schema, TContent>
  = [SchemaLocale<TSchema>] extends [never] ? TContent : Partial<Record<SchemaLocale<TSchema>, TContent>>

type Fields = Record<string, Field>

type OptionalKeys<TFields extends Fields> = {
  [TKey in keyof TFields]-?: TFields[TKey] extends { optional: true } ? TKey : never
}[keyof TFields]

type RequiredKeys<TFields extends Fields> = Exclude<keyof TFields, OptionalKeys<TFields>>

export type ComponentFields<TSchema extends Schema, TName> = TSchema['components'] extends Record<string, ComponentDefinition>
  ? TName extends keyof TSchema['components'] ? TSchema['components'][TName]['fields'] : Fields
  : Fields

type PathHead<TPath extends string> = TPath extends `${infer THead}.${string}` ? THead : TPath

type PathTail<TPath extends string, TKey> = TPath extends TKey
  ? ''
  : TPath extends `${TKey & string}.${infer TRest}` ? TRest : never

type Fewer<TDepth extends number> = [0, 0, 1, 2, 3][TDepth]

type PathsIn<TSchema extends Schema, TFields extends Fields, TDepth extends number> = [TDepth] extends [0] ? never : {
  [TKey in keyof TFields & string]: TFields[TKey] extends { type: 'component', components: infer TNames extends readonly string[] }
    ? TKey | `${TKey}.${PathsIn<TSchema, ComponentFields<TSchema, TNames[number]>, Fewer<TDepth>>}`
    : TFields[TKey] extends { type: 'collection', collections: infer TTargets extends readonly string[] }
      ? TKey | `${TKey}.${TargetPaths<TSchema, TTargets[number], Fewer<TDepth>>}`
      : never
}[keyof TFields & string]

type TargetPaths<TSchema extends Schema, TTarget, TDepth extends number> = TTarget extends keyof TSchema['collections']
  ? PathsIn<TSchema, TSchema['collections'][TTarget]['fields'], TDepth>
  : never

export type Linkable<TSchema extends Schema, TFields extends Fields> = PathsIn<TSchema, TFields, 4>

type Shape = 'content' | 'output' | 'linked'

type Whole = Record<never, never>

export type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

export type LinkPicks<TSchema extends Schema> = {
  readonly [TName in keyof TSchema['collections'] & string]?: readonly (keyof OutputMeta | (keyof TSchema['collections'][TName]['fields'] & string))[]
}

type Kept<TEntry, TTarget, TPicks> = TTarget extends keyof TPicks
  ? TPicks[TTarget] extends readonly (infer TKey)[] ? Simplify<Pick<TEntry, TKey & keyof TEntry>> : TEntry
  : TEntry

type Held<TSchema extends Schema, TFields extends Fields, TKey extends keyof TFields, TOptional extends boolean, TShape extends Shape, TPath extends string, TPicks>
  = TKey extends PathHead<TPath>
    ? FieldValue<TSchema, TFields[TKey], TOptional, 'linked', PathTail<TPath, TKey>, TPicks>
    : FieldValue<TSchema, TFields[TKey], TOptional, TShape, '', TPicks>

type Item<TSchema extends Schema, TFields extends Fields, TShape extends Shape, TPath extends string = '', TPicks = Whole> = {
  [TKey in RequiredKeys<TFields>]: Held<TSchema, TFields, TKey, false, TShape, TPath, TPicks>
} & {
  [TKey in OptionalKeys<TFields>]?: Held<TSchema, TFields, TKey, true, TShape, TPath, TPicks>
}

type TaggedItem<TSchema extends Schema, TNames extends string, TShape extends Shape, TPath extends string, TPicks> = TNames extends string
  ? { component: TNames } & Item<TSchema, ComponentFields<TSchema, TNames>, TShape, TPath, TPicks>
  : never

type Items<TSchema extends Schema, TField extends ComponentField, TShape extends Shape, TPath extends string, TPicks> = Listed<TField, Picked<
  TField['components'],
  Item<TSchema, ComponentFields<TSchema, TField['components'][number]>, TShape, TPath, TPicks>,
  TaggedItem<TSchema, TField['components'][number], TShape, TPath, TPicks>
>>

type LinkedEntry<TSchema extends Schema, TTarget, TPath extends string, TPicks> = TTarget extends keyof TSchema['collections']
  ? Kept<OutputOf<TSchema, TTarget, TPath, TPicks>, TTarget, TPicks>
  : never

export type LinkedBlock<TSchema extends Schema, TTarget, TPath extends string = '', TPicks = Whole> = TTarget extends keyof TSchema['collections']
  ? { collection: TTarget, id: string, entry: LinkedEntry<TSchema, TTarget, TPath, TPicks> }
  : never

type LinkedEntries<TSchema extends Schema, TField extends CollectionField, TPath extends string, TPicks> = Listed<TField, Picked<
  TField['collections'],
  LinkedEntry<TSchema, TField['collections'][number], TPath, TPicks>,
  LinkedBlock<TSchema, TField['collections'][number], TPath, TPicks>
>>

type Value<TSchema extends Schema, TField extends Field, TShape extends Shape, TPath extends string, TPicks> = TField extends ComponentField
  ? Items<TSchema, TField, TShape, TPath, TPicks>
  : TField extends CollectionField
    ? TShape extends 'content'
      ? FieldContent<TField>
      : TShape extends 'output' ? Listed<TField, EntryRef<TField['collections'][number]>> : LinkedEntries<TSchema, TField, TPath, TPicks>
    : FieldContent<TField>

type FieldValue<
  TSchema extends Schema,
  TField extends Field,
  TOptional extends boolean,
  TShape extends Shape,
  TPath extends string,
  TPicks,
> = TShape extends 'content'
  ? TField extends { translate: true }
    ? TOptional extends true
      ? PartiallyTranslated<TSchema, Value<TSchema, TField, TShape, TPath, TPicks>>
      : Translated<TSchema, Value<TSchema, TField, TShape, TPath, TPicks>>
    : Value<TSchema, TField, TShape, TPath, TPicks>
  : Value<TSchema, TField, TShape, TPath, TPicks>

type CollectionContent<TSchema extends Schema, TCollection extends CollectionDefinition> = EntryMeta & Item<TSchema, TCollection['fields'], 'content'>

export type EntryOf<
  TSchema extends Schema,
  TCollectionName extends keyof TSchema['collections'],
> = CollectionContent<TSchema, TSchema['collections'][TCollectionName]>

type CollectionOutput<TSchema extends Schema, TCollection extends CollectionDefinition, TPath extends string, TPicks> = OutputMeta & Item<TSchema, TCollection['fields'], 'output', TPath, TPicks>

export type OutputOf<
  TSchema extends Schema,
  TCollectionName extends keyof TSchema['collections'],
  TPath extends string = '',
  TPicks = Whole,
> = CollectionOutput<TSchema, TSchema['collections'][TCollectionName], TPath, TPicks>

export type ComponentOf<TSchema extends Schema, TName, TPath extends string = '', TPicks = Whole>
  = Simplify<Item<TSchema, ComponentFields<TSchema, TName>, 'output', TPath, TPicks>>

type PathsOf<TSchema extends Schema, TGroup> = TGroup extends Record<string, CollectionDefinition>
  ? { [TName in keyof TGroup]: Linkable<TSchema, TGroup[TName]['fields']> }[keyof TGroup]
  : never

type SchemaPaths<TSchema extends Schema> = PathsOf<TSchema, TSchema['collections']> | PathsOf<TSchema, TSchema['components']>

type LinkPath = [SchemaPaths<RegisteredSchema>] extends [never] ? string : SchemaPaths<RegisteredSchema>

interface Loads<TPath extends string = string> {
  path: TPath
  keep: LinkPicks<RegisteredSchema>
}

type PathOf<TWith extends Loads> = [TWith] extends [never] ? '' : TWith['path']

type KeepOf<TWith extends Loads> = [TWith] extends [never] ? Whole : TWith['keep']

export interface With<TPath extends LinkPath, TKeep extends LinkPicks<RegisteredSchema> = Whole> {
  path: TPath
  keep: TKeep
}

type StoredEntry<TCollectionName extends keyof RegisteredSchema['collections']>
  = [TCollectionName] extends [never] ? Entry : EntryOf<RegisteredSchema, TCollectionName>

type QueriedEntry<TCollectionName extends keyof RegisteredSchema['collections'], TWith extends Loads>
  = [TCollectionName] extends [never] ? OutputEntry : OutputOf<RegisteredSchema, TCollectionName, PathOf<TWith>, KeepOf<TWith>>

type QueriedItem<TComponentName, TWith extends Loads>
  = [TComponentName] extends [never] ? ComponentItem : ComponentOf<RegisteredSchema, TComponentName, PathOf<TWith>, KeepOf<TWith>>

export type Content<TCollectionName extends keyof RegisteredSchema['collections'] = never> = {
  [TKey in keyof StoredEntry<TCollectionName>]: StoredEntry<TCollectionName>[TKey]
}

export type Collection<
  TCollectionName extends keyof RegisteredSchema['collections'] = never,
  TWith extends Loads<Linkable<RegisteredSchema, RegisteredSchema['collections'][TCollectionName]['fields']>> = never,
> = {
  [TKey in keyof QueriedEntry<TCollectionName, TWith>]: QueriedEntry<TCollectionName, TWith>[TKey]
}

export type Component<
  TComponentName extends keyof NonNullable<RegisteredSchema['components']> = never,
  TWith extends Loads<Linkable<RegisteredSchema, ComponentFields<RegisteredSchema, TComponentName>>> = never,
> = {
  [TKey in keyof QueriedItem<TComponentName, TWith>]: QueriedItem<TComponentName, TWith>[TKey]
}

export type Locale = [SchemaLocale<RegisteredSchema>] extends [never] ? string : SchemaLocale<RegisteredSchema>
