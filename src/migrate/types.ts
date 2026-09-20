import type { Entry } from '../entries/types'
import type { ForgePressSchema } from '../schema/types'
import type { SchemaChangeset } from '../store/types'

export interface Renames {
  collections?: Readonly<Record<string, string>>
  fields?: Readonly<Record<string, Readonly<Record<string, string>>>>
  locales?: Readonly<Record<string, string>>
  components?: Readonly<Record<string, string>>
  componentFields?: Readonly<Record<string, Readonly<Record<string, string>>>>
}

export type Fill
  = | { type: 'empty' }
    | { type: 'value', value: string | number }
    | { type: 'field', field: string }
    | { type: 'slug', field: string }
    | { type: 'locale', locale: string }

export type Fix = 'keep' | 'clear' | 'nearest'

export interface Decisions {
  fills?: Readonly<Record<string, Readonly<Record<string, Fill>>>>
  fixes?: Readonly<Record<string, Readonly<Record<string, Fix>>>>
  create?: Readonly<Record<string, readonly string[]>>
}

export type Content = Readonly<Record<string, readonly Entry[]>>

export interface MigrationInput {
  before: ForgePressSchema
  after: ForgePressSchema
  content: Content
  renames?: Renames | undefined
  decisions?: Decisions | undefined
  repair?: boolean | undefined
  now?: string | undefined
  id?: ((collection: string) => string) | undefined
}

export type EffectKind = 'converted' | 'lost' | 'unmatched' | 'missing' | 'invalid' | 'created' | 'removed'

export interface Effect {
  kind: EffectKind
  collection: string
  id: string
  title: string
  field?: string
  label?: string
  locale?: string
  before?: unknown
  after?: unknown
  message?: string
}

export interface Migration {
  changeset: SchemaChangeset
  effects: Effect[]
  blocked: string[]
}

export interface RenameQuestion {
  kind: 'collection' | 'component' | 'field' | 'locale'
  collection?: string
  component?: string
  from: string
  to: string[]
}
