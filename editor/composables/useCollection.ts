import type { Collection, ForgePressSchema } from '../../src/schema/types'
import type { FormField } from '../utils/schema'
import { defaultLocale } from '../../src/schema/locales'
import { toFields } from '../utils/schema'
import { useContent } from './useContent'

export interface CollectionSchema {
  schema: ForgePressSchema
  collection: Collection
  locales: readonly string[]
  chosen: string | undefined
  fields: FormField[]
}

export async function useCollection(name: string): Promise<CollectionSchema> {
  const { store } = useContent()
  const schema = await store.schema()
  const collection = schema.collections[name]

  if (!collection)
    throw new Error(`[forgepress] ${name} is not in the schema`)

  const locales = schema.locales ?? []

  return { schema, collection, locales, chosen: defaultLocale(schema), fields: toFields(collection, locales) }
}
