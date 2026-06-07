import type { Element } from '../core/element'

export interface TextElement extends Element {
  type: 'text'
}

export type TextElementInput = string
