import type { WebenvSchema } from '../../types/core/schema'
import type { Field, SchemaComponent } from '../utils/schema'
import { toFields } from '../utils/schema'
import { useContent } from './useContent'

export interface ComponentSchema {
  schema: WebenvSchema
  component: SchemaComponent
  locales: readonly string[]
  fields: Field[]
}

export async function useComponent(name: string): Promise<ComponentSchema> {
  const { store } = useContent()
  const schema = await store.schema()
  const component = schema.components[name]

  if (!component)
    throw new Error(`[webenv] ${name} is not in the schema`)

  const locales = schema.locales ?? []

  return { schema, component, locales, fields: toFields(component, locales) }
}
