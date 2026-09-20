import type { ComponentFields, LinkedValue, OutputOf, PathHead, PathTail } from '../entries/types'
import type { Field } from '../schema/fields'
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
  boolean: { eq: boolean, ne: boolean }
  choice: { eq: string, ne: string, in: readonly string[] }
  choices: { contains: string }
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
  [TKey in Keys<TSchema, TName>]: KindOf<TSchema, TName, TKey> extends 'text' | 'number' | 'boolean' | 'choice' | 'date' | 'link' ? TKey : never
}[Keys<TSchema, TName>]

type FieldRecord = Record<string, Field>

type Fewer<TDepth extends number> = [0, 0, 1, 2, 3][TDepth]

type PathsIn<TSchema extends ForgePressSchema, TFields extends FieldRecord, TDepth extends number> = [TDepth] extends [0] ? never : {
  [TKey in keyof TFields & string]: TFields[TKey] extends { type: 'component', components: infer TNames extends readonly string[] }
    ? TKey | `${TKey}.${PathsIn<TSchema, ComponentFields<TSchema, TNames[number]>, Fewer<TDepth>>}`
    : TFields[TKey] extends { type: 'collection', collections: infer TTargets extends readonly string[] }
      ? TKey | `${TKey}.${TargetPaths<TSchema, TTargets[number], Fewer<TDepth>>}`
      : never
}[keyof TFields & string]

type TargetPaths<TSchema extends ForgePressSchema, TTarget, TDepth extends number> = TTarget extends CollectionName<TSchema>
  ? PathsIn<TSchema, Fields<TSchema, TTarget>, TDepth>
  : never

type Linkable<TSchema extends ForgePressSchema, TName extends CollectionName<TSchema>> = PathsIn<TSchema, Fields<TSchema, TName>, 4>

type Starting<TKeys> = (TKeys & string) | `${TKeys & string}.${string}`

export type { LinkedBlock } from '../entries/types'

type Linked<TSchema extends ForgePressSchema, TField extends Field, TPath extends string> = LinkedValue<TSchema, TField, TPath>

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
  with: <TPath extends Linkable<TSchema, TName> & Starting<keyof TResult>>(field: TPath) => QueryBuilder<
    TSchema,
    TName,
    WithLinked<TResult, PathHead<TPath> & keyof TResult, Linked<TSchema, Fields<TSchema, TName>[PathHead<TPath> & FieldName<TSchema, TName>], PathTail<TPath>>>
  >
  pick: <TKey extends keyof TResult & string>(...fields: TKey[]) => QueryBuilder<TSchema, TName, Simplify<Pick<TResult, TKey>>>
  first: () => Promise<TResult | undefined>
}

export type Query<TSchema extends ForgePressSchema> = <TName extends CollectionName<TSchema>>(collection: TName) => QueryBuilder<TSchema, TName, OutputOf<TSchema, TName>>
