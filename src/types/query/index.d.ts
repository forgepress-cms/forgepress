import type { WebenvContentRow } from '../core/content'
import type { SchemaLocale, WebenvSchema } from '../core/schema'
import type { ContentLoader } from './loader'

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
  loader: ContentLoader
  schema: () => Promise<WebenvSchema>
}

/**
 * Augmented by the generated `.webenv/webenv.d.ts` to bind {@link query} to the
 * project's schema, e.g. `interface WebenvSchemaRegistry { schema: typeof schema }`.
 */
export interface WebenvSchemaRegistry {}

export type RegisteredSchema = WebenvSchemaRegistry extends { schema: infer TSchema extends WebenvSchema }
  ? TSchema
  : WebenvSchema

type ComponentElements<TSchema extends WebenvSchema, TName extends keyof TSchema['components']>
  = TSchema['components'][TName]['elements']

type TranslatedKeys<TSchema extends WebenvSchema, TName extends keyof TSchema['components']> = {
  [TKey in keyof ComponentElements<TSchema, TName>]:
  ComponentElements<TSchema, TName>[TKey] extends { translate: true } ? TKey : never
}[keyof ComponentElements<TSchema, TName>]

type RelationKeys<TSchema extends WebenvSchema, TName extends keyof TSchema['components']> = {
  [TKey in keyof ComponentElements<TSchema, TName>]:
  ComponentElements<TSchema, TName>[TKey] extends { type: 'relation' } ? TKey : never
}[keyof ComponentElements<TSchema, TName>]

type RelatedComponent<TSchema extends WebenvSchema, TElement> = TElement extends { component: infer TComponent }
  ? TComponent extends keyof TSchema['components'] ? TComponent : never
  : never

/** A resolved relation row, localized when a locale is active so nested fields flatten too. */
type RelatedRow<TSchema extends WebenvSchema, TComponent extends keyof TSchema['components'], TLocale>
  = [TLocale] extends [never]
    ? WebenvContentRow<TSchema, TComponent>
    : Localized<TSchema, TComponent, WebenvContentRow<TSchema, TComponent>>

/** Collapse the translatable `{ locale: value }` maps to plain values once a locale is chosen. */
type Localized<TSchema extends WebenvSchema, TName extends keyof TSchema['components'], TRow> = {
  [TKey in keyof TRow]: TKey extends TranslatedKeys<TSchema, TName>
    ? TRow[TKey] extends Partial<Record<string, infer TValue>> ? TValue : TRow[TKey]
    : TRow[TKey]
}

/** Replace a relation field's id(s) with the resolved row(s). */
type Resolved<TSchema extends WebenvSchema, TName extends keyof TSchema['components'], TKey extends keyof TRow, TRow, TLocale>
  = Omit<TRow, TKey> & {
    [TField in TKey]: ComponentElements<TSchema, TName>[TField] extends { multiple: true }
      ? RelatedRow<TSchema, RelatedComponent<TSchema, ComponentElements<TSchema, TName>[TField]>, TLocale>[]
      : RelatedRow<TSchema, RelatedComponent<TSchema, ComponentElements<TSchema, TName>[TField]>, TLocale> | undefined
  }

export interface QueryBuilder<
  TSchema extends WebenvSchema,
  TName extends keyof TSchema['components'],
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
