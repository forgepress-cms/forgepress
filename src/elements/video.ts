import type { ElementDefinition, ElementOf } from '../types/core/element'

const video = {
  type: 'video',
  label: 'Video',
  options: {
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies ElementDefinition

export type VideoElement = ElementOf<typeof video>

export interface VideoContent {
  url: string
  alt?: string
  width?: number
  height?: number
}

export type VideoElementContent<TElement extends VideoElement> = TElement['multiple'] extends true ? VideoContent[] : VideoContent

export default video
