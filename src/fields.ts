import type { DynamicField, DynamicFieldContent } from './fields/dynamic'
import type { ImageField, ImageFieldContent } from './fields/image'
import type { NumberField, NumberFieldContent } from './fields/number'
import type { RelationField, RelationFieldContent } from './fields/relation'
import type { RichTextField, RichTextFieldContent } from './fields/rich-text'
import type { TextField, TextFieldContent } from './fields/text'
import type { VideoField, VideoFieldContent } from './fields/video'
import dynamic from './fields/dynamic'
import image from './fields/image'
import number from './fields/number'
import relation from './fields/relation'
import richtext from './fields/rich-text'
import text from './fields/text'
import video from './fields/video'

export const fieldTypes = { text, richtext, number, image, video, relation, dynamic }

export type Field = TextField | RichTextField | NumberField | ImageField | VideoField | RelationField | DynamicField

export type FieldContent<TField extends Field>
  = TField extends DynamicField
    ? DynamicFieldContent<TField>
    : TField extends RelationField
      ? RelationFieldContent<TField>
      : TField extends ImageField
        ? ImageFieldContent<TField>
        : TField extends VideoField
          ? VideoFieldContent<TField>
          : TField extends TextField
            ? TextFieldContent
            : TField extends NumberField
              ? NumberFieldContent
              : TField extends RichTextField
                ? RichTextFieldContent
                : never

export const fieldTypeNames = Object.keys(fieldTypes) as Field['type'][]
