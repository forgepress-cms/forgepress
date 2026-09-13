import type { FieldOf, FieldTypeDefinition } from '../../types/field'

const text = {
  type: 'text',
  label: 'Text',
  options: {
    validation: { label: 'Validation Pattern', type: 'text' },
  },
} as const satisfies FieldTypeDefinition

export type TextField = FieldOf<typeof text>

export type TextFieldContent = string

export default text
