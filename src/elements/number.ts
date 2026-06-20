import type { Element } from '../types/core/element'

export interface NumberElement extends Element {
  type: 'number'
  min?: number
  max?: number
  step?: number
}

export type NumberElementContent = number
