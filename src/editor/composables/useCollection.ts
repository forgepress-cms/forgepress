import type { ForgePressSchema } from '../../types/core/schema'
import type { FormField, SchemaCollection } from '../utils/schema'
import { toFields } from '../utils/schema'
import { useContent } from './useContent'

export interface CollectionSchema {
  schema: ForgePressSchema
  collection: SchemaCollection
  locales: readonly string[]
  fields: FormField[]
}

export async function useCollection(name: string): Promise<CollectionSchema> {
  const { store } = useContent()
  const schema = await store.schema()
  const collection = schema.collections[name]

  if (!collection)
    throw new Error(`[forgepress] ${name} is not in the schema`)

  const locales = schema.locales ?? []

  return { schema, collection, locales, fields: toFields(collection, locales) }
}
