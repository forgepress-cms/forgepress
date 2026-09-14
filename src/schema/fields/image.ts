import type { MediaContent } from '../../media/types'
import type { FieldOf, FieldTypeDefinition } from '../../types/field'

const image = {
  type: 'image',
  label: 'Image',
  options: {
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies FieldTypeDefinition

export type ImageField = FieldOf<typeof image>

export type ImageFieldContent<TField extends ImageField> = TField['multiple'] extends true ? MediaContent[] : MediaContent

export default image
