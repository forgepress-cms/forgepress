import type { MediaContent } from '../../media/types'
import type { Listed } from './picked'
import type { FieldOf, FieldTypeDefinition } from './types'

const video = {
  type: 'video',
  label: 'Video',
  options: {
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies FieldTypeDefinition

export type VideoField = FieldOf<typeof video>

export type VideoFieldContent<TField extends VideoField> = Listed<TField, MediaContent>

export default video
