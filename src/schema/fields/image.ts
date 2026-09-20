import type { MediaContent } from '../../media/types'
import type { Listed } from './picked'
import type { FieldOf, FieldTypeDefinition } from './types'

const image = {
  type: 'image',
  label: 'Image',
  options: {
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies FieldTypeDefinition

export type ImageField = FieldOf<typeof image>

export type ImageFieldContent<TField extends ImageField> = Listed<TField, MediaContent>

export default image
