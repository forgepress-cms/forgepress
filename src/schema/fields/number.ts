import type { FieldOf, FieldTypeDefinition } from '../../types/field'

const number = {
  type: 'number',
  label: 'Number',
  options: {
    min: { label: 'Minimum', type: 'number' },
    max: { label: 'Maximum', type: 'number' },
    step: { label: 'Step', type: 'number' },
    index: { label: 'Indexed', type: 'boolean', description: 'Listed in the collection manifest, so queries can filter and sort on it without loading every entry.' },
  },
} as const satisfies FieldTypeDefinition

export type NumberField = FieldOf<typeof number>

export type NumberFieldContent = number

export default number
