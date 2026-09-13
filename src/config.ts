import type { ForgePressConfig } from './types/config'
import type { ForgePressSchema, ValidateLocales } from './types/core/schema'

export function defineForgePressConfig(config: ForgePressConfig): ForgePressConfig {
  return config
}

export function defineForgePressSchema<const TSchema extends ForgePressSchema>(
  schema: TSchema & ValidateLocales<TSchema>,
): TSchema {
  return schema
}
