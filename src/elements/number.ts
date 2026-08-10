import type { ElementDefinition, ElementOf } from '../types/core/element'

const number = {
  type: 'number',
  label: 'Number',
  options: {
    min: { label: 'Minimum', type: 'number' },
    max: { label: 'Maximum', type: 'number' },
    step: { label: 'Step', type: 'number' },
  },
} as const satisfies ElementDefinition

export type NumberElement = ElementOf<typeof number>

export type NumberElementContent = number

export default number
