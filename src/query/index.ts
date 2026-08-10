import type { WebenvContentRow } from '../types/core/content'
import type { QueryBackend, QueryBuilder, RegisteredSchema } from '../types/query'
import { load, reader } from '../content/reader/node'
import { createBuilder } from './builder'

const backend: QueryBackend = {
  reader,
  schema: async () => (await load()).schema,
}

export function query<TName extends keyof RegisteredSchema['components'] & string>(
  component: TName,
): QueryBuilder<RegisteredSchema, TName, WebenvContentRow<RegisteredSchema, TName>> {
  return createBuilder(component, backend) as unknown as QueryBuilder<RegisteredSchema, TName, WebenvContentRow<RegisteredSchema, TName>>
}
