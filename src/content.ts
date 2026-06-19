import type { WebenvContent } from './types/core/content'
import type { WebenvSchema } from './types/core/schema'

export function defineWebenvContent<TSchema extends WebenvSchema, TName extends keyof TSchema['components']>(content: WebenvContent<TSchema, TName>) {
  return content
}
