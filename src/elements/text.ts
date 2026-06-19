import type { Element } from '../types/core/element'

export interface TextElement extends Element {
  type: 'text'
}

export type TextElementContent = string
