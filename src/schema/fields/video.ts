import type { MediaContent } from '../../media/types'
import type { FieldOf, FieldTypeDefinition } from '../../types/field'

const video = {
  type: 'video',
  label: 'Video',
  options: {
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies FieldTypeDefinition

export type VideoField = FieldOf<typeof video>

export type VideoFieldContent<TField extends VideoField> = TField['multiple'] extends true ? MediaContent[] : MediaContent

export default video
