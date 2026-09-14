import type { FieldOf, FieldTypeDefinition } from '../../types/field'

const relation = {
  type: 'relation',
  label: 'Relation',
  options: {
    collection: { label: 'Collection', type: 'collection', required: true },
    multiple: { label: 'Multiple', type: 'boolean' },
    index: { label: 'Indexed', type: 'boolean', description: 'Listed in the collection manifest, so queries can filter and sort on it without loading every entry.' },
  },
} as const satisfies FieldTypeDefinition

export type RelationField = FieldOf<typeof relation>

export type RelationFieldContent<TField extends RelationField> = TField['multiple'] extends true ? string[] : string

export default relation
