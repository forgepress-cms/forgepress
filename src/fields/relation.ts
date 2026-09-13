import type { FieldOf, FieldTypeDefinition } from '../types/core/field'

const relation = {
  type: 'relation',
  label: 'Relation',
  options: {
    collection: { label: 'Collection', type: 'collection', required: true },
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies FieldTypeDefinition

export type RelationField = FieldOf<typeof relation>

export type RelationFieldContent<TField extends RelationField> = TField['multiple'] extends true ? string[] : string

export default relation
