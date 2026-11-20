import type { CollectionDefinition, Schema } from '../../../src/schema'
import type { FormField } from '../../utils'
import { defaultLocale } from '../../../src/schema'
import { toFields } from '../../utils'
import { useContent } from './useContent'

export interface CollectionSchema {
  schema: Schema
  collection: CollectionDefinition
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

  return { schema, collection, locales, chosen: defaultLocale(schema), fields: toFields(collection, locales, schema.components) }
}
