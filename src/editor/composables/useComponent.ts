import type { WebenvSchema } from '../../types/core/schema'
import type { Field, SchemaComponent } from '../utils/schema'
import { source } from '../../content/source'
import { toFields } from '../utils/schema'

export interface ComponentSchema {
  schema: WebenvSchema
  component: SchemaComponent
  locales: readonly string[]
  fields: Field[]
}

export async function useComponent(name: string): Promise<ComponentSchema> {
  const schema = await source.schema()
  const component = schema.components[name]

  if (!component)
    throw new Error(`[webenv] ${name} is not in the schema`)

  const locales = schema.locales ?? []

  return { schema, component, locales, fields: toFields(component, locales) }
}
