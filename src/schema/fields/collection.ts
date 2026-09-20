import type { EntryRef, Listed, Picked } from './picked'
import type { FieldOf, FieldTypeDefinition } from './types'

const collection = {
  type: 'collection',
  label: 'Collection',
  options: {
    collections: { label: 'Collections', type: 'collections', required: true, description: 'The collections entries come from. Pick more than one to let content choose.' },
    multiple: { label: 'Multiple', type: 'boolean', description: 'Content holds a list of entries instead of one.' },
    index: { label: 'Indexed', type: 'boolean', description: 'Listed in the collection manifest, so queries can filter and sort on it without loading every entry.' },
  },
} as const satisfies FieldTypeDefinition

export type CollectionField = FieldOf<typeof collection>

export type CollectionFieldContent<TField extends CollectionField>
  = Listed<TField, Picked<TField['collections'], string, EntryRef<TField['collections'][number]>>>

export default collection
