import type { ElementDefinition, ElementOf } from '../types/core/element'

const image = {
  type: 'image',
  label: 'Image',
  options: {
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies ElementDefinition

export type ImageElement = ElementOf<typeof image>

export interface ImageContent {
  url: string
  alt?: string
  width?: number
  height?: number
}

export type ImageElementContent<TElement extends ImageElement> = TElement['multiple'] extends true ? ImageContent[] : ImageContent

export default image
