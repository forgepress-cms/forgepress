import type { ElementDefinition, ElementOf } from '../types/core/element'

const text = {
  type: 'text',
  label: 'Text',
  options: {
    validation: { label: 'Validation Pattern', type: 'text' },
  },
} as const satisfies ElementDefinition

export type TextElement = ElementOf<typeof text>

export type TextElementContent = string

export default text
