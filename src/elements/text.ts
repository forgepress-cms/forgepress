import type { Element } from '../types/core/element'

export interface TextElement extends Element {
  type: 'text'
  validation?: string
}

export type TextElementContent = string
