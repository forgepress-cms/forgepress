import type { EntryOf } from '../types/core/content'
import type { QueryBackend, QueryBuilder, RegisteredSchema } from '../types/query'
import { source } from '#content-source'
import { createBuilder } from './builder'

const backend: QueryBackend = { source }

export function query<TName extends keyof RegisteredSchema['collections'] & string>(
  collection: TName,
): QueryBuilder<RegisteredSchema, TName, EntryOf<RegisteredSchema, TName>> {
  return createBuilder(collection, backend) as unknown as QueryBuilder<RegisteredSchema, TName, EntryOf<RegisteredSchema, TName>>
}
