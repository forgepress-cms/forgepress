import type { WebenvSchema } from './types/core/schema'
import type { WebenvContent } from './types/core/content'

export function defineWebenvContent<TSchema extends WebenvSchema, TName extends keyof TSchema['components']>(content: WebenvContent<TSchema, TName>) {
  return content
}
