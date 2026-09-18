import type { ForgePressSchema } from './types'

export function defaultLocale(schema: { locales?: readonly string[], defaultLocale?: string }): string | undefined {
  const locales = schema.locales ?? []
  const chosen = schema.defaultLocale

  return chosen !== undefined && locales.includes(chosen) ? chosen : locales[0]
}

export function isDefaultLocale(schema: ForgePressSchema, locale: string): boolean {
  return defaultLocale(schema) === locale
}
