import type { ContentSource } from '../store/types'
import type { EntryOf } from '../types/entry'
import type { ForgePressSchema, SchemaLocale } from '../types/schema'

export type Operator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'

export interface WhereClause {
  field: string
  op: Operator
  value: unknown
}

export interface SortClause {
  field: string
  dir: 'asc' | 'desc'
}

export interface QueryPlan {
  where: WhereClause[]
  sort: SortClause[]
  locale?: string
  offset: number
  limit?: number
  pick?: string[]
}

export interface QueryBackend {
  source: ContentSource
}

type CollectionFields<TSchema extends ForgePressSchema, TName extends keyof TSchema['collections']>
  = TSchema['collections'][TName]['fields']

type TranslatedKeys<TSchema extends ForgePressSchema, TName extends keyof TSchema['collections']> = {
  [TKey in keyof CollectionFields<TSchema, TName>]:
  CollectionFields<TSchema, TName>[TKey] extends { translate: true } ? TKey : never
}[keyof CollectionFields<TSchema, TName>]

type RelationKeys<TSchema extends ForgePressSchema, TName extends keyof TSchema['collections']> = {
  [TKey in keyof CollectionFields<TSchema, TName>]:
  CollectionFields<TSchema, TName>[TKey] extends { type: 'relation' } ? TKey : never
}[keyof CollectionFields<TSchema, TName>]

type FieldAt<TSchema extends ForgePressSchema, TName extends keyof TSchema['collections'], TField>
  = TField extends keyof CollectionFields<TSchema, TName> ? CollectionFields<TSchema, TName>[TField] : never

type RelatedCollection<TSchema extends ForgePressSchema, TField> = TField extends { collection: infer TCollection }
  ? TCollection extends keyof TSchema['collections'] ? TCollection : never
  : never

type RelatedRow<TSchema extends ForgePressSchema, TCollection extends keyof TSchema['collections'], TLocale>
  = [TLocale] extends [never]
    ? EntryOf<TSchema, TCollection>
    : Localized<TSchema, TCollection, EntryOf<TSchema, TCollection>>

type Localized<TSchema extends ForgePressSchema, TName extends keyof TSchema['collections'], TRow> = {
  [TKey in keyof TRow]: TKey extends TranslatedKeys<TSchema, TName>
    ? TRow[TKey] extends Partial<Record<string, infer TValue>> ? TValue : TRow[TKey]
    : TRow[TKey]
}

type Resolved<TSchema extends ForgePressSchema, TName extends keyof TSchema['collections'], TKey extends keyof TRow, TRow, TLocale>
  = Omit<TRow, TKey> & {
    [TField in TKey]: FieldAt<TSchema, TName, TField> extends { multiple: true }
      ? RelatedRow<TSchema, RelatedCollection<TSchema, FieldAt<TSchema, TName, TField>>, TLocale>[]
      : RelatedRow<TSchema, RelatedCollection<TSchema, FieldAt<TSchema, TName, TField>>, TLocale> | undefined
  }

export interface QueryBuilder<
  TSchema extends ForgePressSchema,
  TName extends keyof TSchema['collections'],
  TRow,
  TLocale = never,
> extends Promise<TRow[]> {
  where: {
    <TKey extends keyof TRow & string>(field: TKey, value: TRow[TKey]): QueryBuilder<TSchema, TName, TRow, TLocale>
    <TKey extends keyof TRow & string>(field: TKey, op: Operator, value: unknown): QueryBuilder<TSchema, TName, TRow, TLocale>
  }
  sort: (field: keyof TRow & string, dir?: 'asc' | 'desc') => QueryBuilder<TSchema, TName, TRow, TLocale>
  limit: (count: number) => QueryBuilder<TSchema, TName, TRow, TLocale>
  offset: (count: number) => QueryBuilder<TSchema, TName, TRow, TLocale>
  locale: <TChosen extends ([SchemaLocale<TSchema>] extends [never] ? string : SchemaLocale<TSchema>)>(locale: TChosen) => QueryBuilder<TSchema, TName, Localized<TSchema, TName, TRow>, TChosen>
  with: <TKey extends RelationKeys<TSchema, TName> & keyof TRow & string>(field: TKey) => QueryBuilder<TSchema, TName, Resolved<TSchema, TName, TKey, TRow, TLocale>, TLocale>
  pick: <TKey extends keyof TRow & string>(...fields: TKey[]) => QueryBuilder<TSchema, TName, Pick<TRow, TKey>, TLocale>
  first: () => Promise<TRow | undefined>
}
