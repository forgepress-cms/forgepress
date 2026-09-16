import type { FieldOf, FieldTypeDefinition } from './types'

const richtext = {
  type: 'richtext',
  label: 'Rich Text',
  options: {},
} as const satisfies FieldTypeDefinition

export type RichTextField = FieldOf<typeof richtext>

export type RichTextFieldContent = string

export default richtext
