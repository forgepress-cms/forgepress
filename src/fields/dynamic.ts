import type { FieldOf, FieldTypeDefinition } from '../types/core/field'

const dynamic = {
  type: 'dynamic',
  label: 'Dynamic',
  options: {
    collections: { label: 'Collections', type: 'collections', required: true },
  },
} as const satisfies FieldTypeDefinition

export type DynamicField = FieldOf<typeof dynamic>

export interface DynamicBlock<TCollectionName extends string = string> {
  collection: TCollectionName
  id: string
}

export type DynamicFieldContent<TField extends DynamicField>
  = DynamicBlock<TField['collections'][number]>[]

export default dynamic
