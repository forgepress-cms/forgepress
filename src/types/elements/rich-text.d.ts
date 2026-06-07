import type { Element } from '../core/element'

export interface RichTextElement extends Element {
  type: 'richtext'
}

export type RichTextElementInput = string
