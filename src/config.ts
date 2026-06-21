import type { WebenvConfig } from './types/config'
import type { WebenvContent } from './types/core/content'
import type { WebenvSchema } from './types/core/schema'
import type { RegisteredSchema } from './types/query'

export function defineWebenvConfig(config: WebenvConfig) {
  return config
}

export function defineWebenvSchema<const T extends WebenvSchema>(schema: T) {
  return schema
}

export function defineWebenvContent<TName extends keyof RegisteredSchema['components']>(content: WebenvContent<RegisteredSchema, TName>) {
  return content
}
