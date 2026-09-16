import type { FieldOf, FieldTypeDefinition } from './types'

const text = {
  type: 'text',
  label: 'Text',
  options: {
    validation: { label: 'Validation Pattern', type: 'text' },
    index: { label: 'Indexed', type: 'boolean', description: 'Listed in the collection manifest, so queries can filter and sort on it without loading every entry.' },
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
