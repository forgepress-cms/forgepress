import type { WebenvConfig } from './types/config'
import type { WebenvContent } from './types/core/content'
import type { WebenvSchema } from './types/core/schema'

export function defineWebenvConfig<const T extends WebenvConfig>(config: T) {
  return config
}

export function defineWebenvSchema<const T extends WebenvSchema>(schema: T) {
  return schema
}

export function defineWebenvContent<const TSchema extends WebenvSchema, const TName extends keyof TSchema['components']>(content: WebenvContent<TSchema, TName>) {
  return content
}
