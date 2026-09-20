import type { BooleanField, BooleanFieldContent } from './boolean'
import type { CollectionField, CollectionFieldContent } from './collection'
import type { ComponentField, ComponentFieldContent } from './component'
import type { ImageField, ImageFieldContent } from './image'
import type { ListField, ListFieldContent } from './list'
import type { NumberField, NumberFieldContent } from './number'
import type { RichTextField, RichTextFieldContent } from './rich-text'
import type { TextField, TextFieldContent } from './text'
import type { VideoField, VideoFieldContent } from './video'
import boolean from './boolean'
import collection from './collection'
import component from './component'
import image from './image'
import list from './list'
import number from './number'
import richtext from './rich-text'
import text from './text'
import video from './video'

export const fieldTypes = { text, richtext, number, boolean, list, image, video, collection, component }

export type Field = TextField | RichTextField | NumberField | BooleanField | ListField | ImageField | VideoField | CollectionField | ComponentField

export type FieldContent<TField extends Field>
  = TField extends ComponentField
    ? ComponentFieldContent<TField>
    : TField extends CollectionField
      ? CollectionFieldContent<TField>
      : TField extends ListField
        ? ListFieldContent<TField>
        : TField extends ImageField
          ? ImageFieldContent<TField>
          : TField extends VideoField
            ? VideoFieldContent<TField>
            : TField extends TextField
              ? TextFieldContent
              : TField extends NumberField
                ? NumberFieldContent
                : TField extends BooleanField
                  ? BooleanFieldContent
                  : TField extends RichTextField
                    ? RichTextFieldContent
                    : never

export const fieldTypeNames = Object.keys(fieldTypes) as Field['type'][]

export function isTranslated(field: Field, locales: readonly string[]): boolean {
  return field.translate === true && locales.length > 0
}

interface FieldHolder {
  fields: Readonly<Record<string, Field>>
}

export function translatesAnything(fields: Readonly<Record<string, Field>>, components: Readonly<Record<string, FieldHolder>>, locales: readonly string[], seen: readonly string[] = []): boolean {
  return Object.values(fields).some((field) => {
    if (isTranslated(field, locales))
      return true

    if (field.type !== 'component')
      return false

    return field.components.some((name) => {
      const component = components[name]

      return component !== undefined && !seen.includes(name) && translatesAnything(component.fields, components, locales, [...seen, name])
    })
  })
}

export function fieldCollections(field: Field): readonly string[] {
  return field.type === 'collection' ? field.collections : []
}

export function fieldComponents(field: Field): readonly string[] {
  return field.type === 'component' ? field.components : []
}
