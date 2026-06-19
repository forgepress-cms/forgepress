import type { Element } from '../types/core/element'

export interface RichTextElement extends Element {
  type: 'richtext'
}

export type RichTextElementContent = string
