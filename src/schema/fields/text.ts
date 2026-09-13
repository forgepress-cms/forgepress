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

export function compilePattern(validation: string): RegExp | SyntaxError {
  try {
    return new RegExp(validation, 'u')
  }
  catch (error) {
    return error as SyntaxError
  }
}

export default text
