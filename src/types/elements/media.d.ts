import type { Element } from '../core/element'

export interface MediaElement extends Element {
  type: 'image' | 'video'
}

export interface MediaElementInput {
  url: string
  alt?: string
  width?: number
  height?: number
}
