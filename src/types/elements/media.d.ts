import type { Element } from '../core/element'

export interface MediaElement extends Element {
  type: 'image' | 'video'
  multiple?: boolean
}

interface Content {
  url: string
  alt?: string
  width?: number
  height?: number
}

export type MediaElementContent<TElement extends { multiple?: boolean }> = TElement['multiple'] extends true ? Content[] : Content
