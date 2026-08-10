import type { ElementDefinition, ElementOf } from '../types/core/element'

const richtext = {
  type: 'richtext',
  label: 'Rich Text',
  options: {},
} as const satisfies ElementDefinition

export type RichTextElement = ElementOf<typeof richtext>

export type RichTextElementContent = string

export default richtext
