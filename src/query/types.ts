import type { OutputOf } from '../entries/types'
import type { ForgePressSchema, SchemaLocale } from '../schema/types'

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
  offset: number
  limit?: number
  pick?: string[]
  with: string[]
}

export type CollectionName<TSchema extends ForgePressSchema> = keyof TSchema['collections'] & string

type Fields<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>> = TSchema['collections'][TName]['fields']

type FieldName<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>> = keyof Fields<TSchema, TName> & string

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

type Kind<TField> = TField extends { type: 'number' }
  ? 'number'
  : TField extends { type: 'text' | 'richtext' }
    ? 'text'
    : TField extends { type: 'relation', multiple: true }
      ? 'links'
      : TField extends { type: 'relation' }
        ? 'link'
        : TField extends { type: 'dynamic' }
          ? 'links'
          : 'none'

type KindOf<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>, TKey> = TKey extends 'id'
  ? 'text'
  : TKey extends 'createdAt' | 'updatedAt'
    ? 'date'
    : TKey extends FieldName<TSchema, TName>
      ? Kind<Fields<TSchema, TName>[TKey]>
      : 'none'

export interface Operands {
  text: { eq: string, ne: string, in: readonly string[], contains: string }
  number: { eq: number, ne: number, gt: number, gte: number, lt: number, lte: number, in: readonly number[] }
  date: { eq: string, ne: string, gt: string, gte: string, lt: string, lte: string, in: readonly string[] }
  link: { eq: string, ne: string, in: readonly string[] }
  links: { contains: string }
  none: Record<never, never>
}

type Keys<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>> = 'id' | 'createdAt' | 'updatedAt' | FieldName<TSchema, TName>

type OperatorOf<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>, TKey> = keyof Operands[KindOf<TSchema, TName, TKey>] & Operator

type Operand<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>, TKey, TOperator> = TOperator extends keyof Operands[KindOf<TSchema, TName, TKey>]
  ? Operands[KindOf<TSchema, TName, TKey>][TOperator]
  : never

type Filterable<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>> = {
  [TKey in Keys<TSchema, TName>]: [OperatorOf<TSchema, TName, TKey>] extends [never] ? never : TKey
}[Keys<TSchema, TName>]

type Comparable<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>> = {
  [TKey in Keys<TSchema, TName>]: 'eq' extends OperatorOf<TSchema, TName, TKey> ? TKey : never
}[Keys<TSchema, TName>]

type Sortable<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>> = {
  [TKey in Keys<TSchema, TName>]: KindOf<TSchema, TName, TKey> extends 'text' | 'number' | 'date' | 'link' ? TKey : never
}[Keys<TSchema, TName>]

type Linkable<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>> = {
  [TKey in FieldName<TSchema, TName>]: Fields<TSchema, TName>[TKey] extends { type: 'relation' | 'dynamic' } ? TKey : never
}[FieldName<TSchema, TName>]

export type LinkedBlock<TSchema extends ForgePressSchema, TTarget> = TTarget extends CollectionName<TSchema>
  ? { collection: TTarget, id: string, entry: OutputOf<TSchema, TTarget> }
  : never

type Linked<TSchema extends ForgePressSchema, TField> = TField extends { type: 'relation', collection: infer TTarget extends CollectionName<TSchema> }
  ? TField extends { multiple: true } ? OutputOf<TSchema, TTarget>[] : OutputOf<TSchema, TTarget>
  : TField extends { type: 'dynamic', collections: readonly (infer TTarget)[] }
    ? LinkedBlock<TSchema, TTarget>[]
    : never

type WithLinked<TResult, TKey extends keyof TResult, TValue> = Simplify<Omit<TResult, TKey> & (Record<never, never> extends Pick<TResult, TKey> ? { [TField in TKey]?: TValue } : { [TField in TKey]: TValue })>

type SiteLocale<TSchema extends ForgePressSchema> = [SchemaLocale<TSchema>] extends [never] ? string : SchemaLocale<TSchema>

export interface QueryBuilder<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>, TResult> extends Promise<TResult[]> {
  where: {
    <TKey extends Comparable<TSchema, TName>>(field: TKey, value: Operand<TSchema, TName, TKey, 'eq'>): QueryBuilder<TSchema, TName, TResult>
    <TKey extends Filterable<TSchema, TName>, TOperator extends OperatorOf<TSchema, TName, TKey>>(field: TKey, operator: TOperator, value: Operand<TSchema, TName, TKey, TOperator>): QueryBuilder<TSchema, TName, TResult>
  }
  sort: (field: Sortable<TSchema, TName>, direction?: 'asc' | 'desc') => QueryBuilder<TSchema, TName, TResult>
  limit: (count: number) => QueryBuilder<TSchema, TName, TResult>
  offset: (count: number) => QueryBuilder<TSchema, TName, TResult>
  locale: (locale: SiteLocale<TSchema>) => QueryBuilder<TSchema, TName, TResult>
  with: <TKey extends Linkable<TSchema, TName> & keyof TResult>(field: TKey) => QueryBuilder<TSchema, TName, WithLinked<TResult, TKey, Linked<TSchema, Fields<TSchema, TName>[TKey]>>>
  pick: <TKey extends keyof TResult & string>(...fields: TKey[]) => QueryBuilder<TSchema, TName, Simplify<Pick<TResult, TKey>>>
  first: () => Promise<TResult | undefined>
}

export type Query<TSchema extends ForgePressSchema> = <TName extends CollectionName<TSchema>>(collection: TName) => QueryBuilder<TSchema, TName, OutputOf<TSchema, TName>>
