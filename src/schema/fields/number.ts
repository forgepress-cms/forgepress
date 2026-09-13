import type { FieldOf, FieldTypeDefinition } from '../../types/field'

const number = {
  type: 'number',
  label: 'Number',
  options: {
    min: { label: 'Minimum', type: 'number' },
    max: { label: 'Maximum', type: 'number' },
    step: { label: 'Step', type: 'number' },
  },
} as const satisfies FieldTypeDefinition

export type NumberField = FieldOf<typeof number>

export type NumberFieldContent = number

export default number
