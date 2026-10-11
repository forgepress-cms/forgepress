import type { SchemaDraft } from '../../src/migrate/schema'
import type { Renames } from '../../src/migrate/types'
import type { CollectionDefinition, Schema } from '../../src/schema/types'
import { useRouter } from './useRouter'

export type GroupKind = 'collections' | 'components'

export interface SchemaGroup {
  kind: GroupKind
  name: string
  noun: string
  path: (field?: string) => string
  definition: (schema: Schema | SchemaDraft) => CollectionDefinition | undefined
  holder: (draft: SchemaDraft) => CollectionDefinition
  fieldRenames: (from: string, to: string) => Renames
}

export function groupPath(kind: GroupKind, name: string, field?: string): string {
  return ['schema', kind, name, ...field === undefined ? [] : [field]].join('/')
}

export function groupOf(schema: Schema | SchemaDraft, kind: GroupKind): Record<string, CollectionDefinition> {
  return (kind === 'components' ? schema.components : schema.collections) ?? {}
}

export function useSchemaGroup(): SchemaGroup {
  const { params } = useRouter().route.value
  const kind: GroupKind = params.component ? 'components' : 'collections'
  const name = params.component ?? params.collection

  if (!name)
    throw new Error('[forgepress] the route names neither a collection nor a component')

  return {
    kind,
    name,
    noun: kind === 'components' ? 'component' : 'collection',
    path: field => groupPath(kind, name, field),
    definition: schema => groupOf(schema, kind)[name],
    holder: (draft) => {
      const found = groupOf(draft, kind)[name]

      if (!found)
        throw new Error(`[forgepress] ${name} is not in the schema`)

      return found
    },
    fieldRenames: (from, to) => kind === 'components'
      ? { componentFields: { [name]: { [from]: to } } }
      : { fields: { [name]: { [from]: to } } },
  }
}
