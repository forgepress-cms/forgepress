import type { FieldOf, FieldTypeDefinition } from '../types/core/field'

const video = {
  type: 'video',
  label: 'Video',
  options: {
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies FieldTypeDefinition

export type VideoField = FieldOf<typeof video>

export interface VideoContent {
  url: string
  alt?: string
  width?: number
  height?: number
}

export type VideoFieldContent<TField extends VideoField> = TField['multiple'] extends true ? VideoContent[] : VideoContent

export default video
