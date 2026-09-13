import type { FieldOf, FieldTypeDefinition } from '../../types/field'

const image = {
  type: 'image',
  label: 'Image',
  options: {
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies FieldTypeDefinition

export type ImageField = FieldOf<typeof image>

export interface ImageContent {
  url: string
  alt?: string
  width?: number
  height?: number
}

export type ImageFieldContent<TField extends ImageField> = TField['multiple'] extends true ? ImageContent[] : ImageContent

export default image
