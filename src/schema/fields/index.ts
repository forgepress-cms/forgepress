import type { DynamicField, DynamicFieldContent } from './dynamic'
import type { ImageField, ImageFieldContent } from './image'
import type { NumberField, NumberFieldContent } from './number'
import type { RelationField, RelationFieldContent } from './relation'
import type { RichTextField, RichTextFieldContent } from './rich-text'
import type { TextField, TextFieldContent } from './text'
import type { VideoField, VideoFieldContent } from './video'
import dynamic from './dynamic'
import image from './image'
import number from './number'
import relation from './relation'
import richtext from './rich-text'
import text from './text'
import video from './video'

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

export function isTranslated(field: Field, locales: readonly string[]): boolean {
  return field.translate === true && locales.length > 0
}
