import type { Linkable, LinkPicks, OutputOf, Simplify } from '../entries/types'
import type { Schema, SchemaLocale } from '../schema/types'

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

export type Picks = Readonly<Record<string, readonly string[]>>

export interface QueryPlan {
  where: WhereClause[]
  sort: SortClause[]
  offset: number
  limit?: number
  pick?: string[]
  with: string[]
}

export type CollectionName<TSchema extends Schema> = keyof TSchema['collections'] & string

type Fields<TSchema extends Schema, TName extends CollectionName<TSchema>> = TSchema['collections'][TName]['fields']

type FieldName<TSchema extends Schema, TName extends CollectionName<TSchema>> = keyof Fields<TSchema, TName> & string

type Kind<TField> = TField extends { type: 'list', multiple: true }
  ? 'choices'
  : TField extends { type: 'list' }
    ? 'choice'
    : TField extends { type: 'number' }
      ? 'number'
      : TField extends { type: 'boolean' }
        ? 'boolean'
        : TField extends { type: 'text' | 'richtext' }
          ? 'text'
          : TField extends { type: 'collection', multiple: true }
            ? 'links'
            : TField extends { type: 'collection' }
              ? 'link'
              : 'none'

type KindOf<TSchema extends Schema, TName extends CollectionName<TSchema>, TKey> = TKey extends 'id'
  ? 'text'
  : TKey extends 'createdAt' | 'updatedAt'
    ? 'date'
    : TKey extends FieldName<TSchema, TName>
      ? Kind<Fields<TSchema, TName>[TKey]>
      : 'none'

export interface Operands {
  text: { eq: string, ne: string, in: readonly string[], contains: string }
  number: { eq: number, ne: number, gt: number, gte: number, lt: number, lte: number, in: readonly number[] }
  boolean: { eq: boolean, ne: boolean }
  choice: { eq: string, ne: string, in: readonly string[] }
  choices: { contains: string }
  date: { eq: string, ne: string, gt: string, gte: string, lt: string, lte: string, in: readonly string[] }
  link: { eq: string, ne: string, in: readonly string[] }
  links: { contains: string }
  none: Record<never, never>
}

type Keys<TSchema extends Schema, TName extends CollectionName<TSchema>> = 'id' | 'createdAt' | 'updatedAt' | FieldName<TSchema, TName>

type OperatorOf<TSchema extends Schema, TName extends CollectionName<TSchema>, TKey> = keyof Operands[KindOf<TSchema, TName, TKey>] & Operator

type Operand<TSchema extends Schema, TName extends CollectionName<TSchema>, TKey, TOperator> = TOperator extends keyof Operands[KindOf<TSchema, TName, TKey>]
  ? Operands[KindOf<TSchema, TName, TKey>][TOperator]
  : never

type Filterable<TSchema extends Schema, TName extends CollectionName<TSchema>> = {
  [TKey in Keys<TSchema, TName>]: [OperatorOf<TSchema, TName, TKey>] extends [never] ? never : TKey
}[Keys<TSchema, TName>]

type Comparable<TSchema extends Schema, TName extends CollectionName<TSchema>> = {
  [TKey in Keys<TSchema, TName>]: 'eq' extends OperatorOf<TSchema, TName, TKey> ? TKey : never
}[Keys<TSchema, TName>]

type Sortable<TSchema extends Schema, TName extends CollectionName<TSchema>> = {
  [TKey in Keys<TSchema, TName>]: KindOf<TSchema, TName, TKey> extends 'text' | 'number' | 'boolean' | 'choice' | 'date' | 'link' ? TKey : never
}[Keys<TSchema, TName>]

type Step = 'with' | 'pick'

type Starting<TKeys> = (TKeys & string) | `${TKeys & string}.${string}`

type Path<TSchema extends Schema, TName extends CollectionName<TSchema>, TResult> = Linkable<TSchema, Fields<TSchema, TName>> & Starting<keyof TResult>

type Loaded<TSchema extends Schema, TName extends CollectionName<TSchema>, TResult, TUsed, TPath extends string, TKeep> = 'pick' extends TUsed
  ? Simplify<Pick<OutputOf<TSchema, TName, TPath, TKeep>, keyof TResult & keyof OutputOf<TSchema, TName, TPath, TKeep>>>
  : OutputOf<TSchema, TName, TPath, TKeep>

export type { LinkedBlock } from '../entries/types'

type SiteLocale<TSchema extends Schema> = [SchemaLocale<TSchema>] extends [never] ? string : SchemaLocale<TSchema>

interface Steps<TSchema extends Schema, TName extends CollectionName<TSchema>, TResult, TUsed extends Step> {
  where: {
    <TKey extends Comparable<TSchema, TName>>(field: TKey, value: Operand<TSchema, TName, TKey, 'eq'>): QueryBuilder<TSchema, TName, TResult, TUsed>
    <TKey extends Filterable<TSchema, TName>, TOperator extends OperatorOf<TSchema, TName, TKey>>(field: TKey, operator: TOperator, value: Operand<TSchema, TName, TKey, TOperator>): QueryBuilder<TSchema, TName, TResult, TUsed>
  }
  sort: (field: Sortable<TSchema, TName>, direction?: 'asc' | 'desc') => QueryBuilder<TSchema, TName, TResult, TUsed>
  limit: (count: number) => QueryBuilder<TSchema, TName, TResult, TUsed>
  offset: (count: number) => QueryBuilder<TSchema, TName, TResult, TUsed>
  locale: (locale: SiteLocale<TSchema>) => QueryBuilder<TSchema, TName, TResult, TUsed>
  with: {
    <TPath extends Path<TSchema, TName, TResult>>(...paths: [TPath, ...TPath[]]): QueryBuilder<TSchema, TName, Loaded<TSchema, TName, TResult, TUsed, TPath, Record<never, never>>, TUsed | 'with'>
    <TPath extends Path<TSchema, TName, TResult>, const TKeep extends LinkPicks<TSchema>>(...paths: [TPath, ...TPath[], TKeep]): QueryBuilder<TSchema, TName, Loaded<TSchema, TName, TResult, TUsed, TPath, TKeep>, TUsed | 'with'>
  }
  pick: <TKey extends keyof TResult & string>(...fields: TKey[]) => QueryBuilder<TSchema, TName, Simplify<Pick<TResult, TKey>>, TUsed | 'pick'>
  first: () => Promise<TResult | undefined>
}

export type QueryBuilder<TSchema extends Schema, TName extends CollectionName<TSchema>, TResult, TUsed extends Step = never> = Omit<Steps<TSchema, TName, TResult, TUsed>, TUsed> & Promise<TResult[]>

export type Query<TSchema extends Schema> = <TName extends CollectionName<TSchema>>(collection: TName) => QueryBuilder<TSchema, TName, OutputOf<TSchema, TName>>
