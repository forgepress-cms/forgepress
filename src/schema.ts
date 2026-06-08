import type { WebenvSchema } from './types/core/schema'

export function defineWebenvSchema<const T extends WebenvSchema>(schema: T) {
  return schema
}
