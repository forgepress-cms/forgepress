import type { Collection } from './collection'

export interface ForgePressSchema {
  collections: Record<string, Collection>
  locales?: readonly string[]
}

export type SchemaLocale<TSchema extends ForgePressSchema>
  = TSchema['locales'] extends readonly string[] ? TSchema['locales'][number] : never

type TranslatedFields<TSchema extends ForgePressSchema> = {
  [TCollection in keyof TSchema['collections']]: {
    [TField in keyof TSchema['collections'][TCollection]['fields']]:
    TSchema['collections'][TCollection]['fields'][TField] extends { translate: true } ? true : never
  }[keyof TSchema['collections'][TCollection]['fields']]
}[keyof TSchema['collections']]

export type ValidateLocales<TSchema extends ForgePressSchema>
  = [TranslatedFields<TSchema>] extends [never]
    ? unknown
    : TSchema['locales'] extends readonly [string, ...string[]]
      ? unknown
      : { locales: readonly [string, ...string[]] }
