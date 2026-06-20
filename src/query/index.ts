import type { WebenvContentRow } from '../types/core/content'
import type { QueryBackend, QueryBuilder, RegisteredSchema } from '../types/query'
import { nodeBackend } from './backend/node'
import { createBuilder } from './builder'

const backend: QueryBackend = nodeBackend

export function query<TName extends keyof RegisteredSchema['components'] & string>(
  component: TName,
): QueryBuilder<RegisteredSchema, TName, WebenvContentRow<RegisteredSchema, TName>> {
  return createBuilder(component, backend) as unknown as QueryBuilder<RegisteredSchema, TName, WebenvContentRow<RegisteredSchema, TName>>
}
