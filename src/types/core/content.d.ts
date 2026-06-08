import type { ElementContentMetadata } from './element'
import type { Component } from './component'
import type { ElementContent, ElementType } from '../elements'
import type { WebenvSchema, SchemaLocale } from './schema'

type TranslatedContent<TSchema extends WebenvSchema, TContent> =
  [SchemaLocale<TSchema>] extends [never] ? TContent : Record<SchemaLocale<TSchema>, TContent>

type OptionalTranslatedContent<TSchema extends WebenvSchema, TContent> =
  [SchemaLocale<TSchema>] extends [never] ? TContent : Partial<Record<SchemaLocale<TSchema>, TContent>>

type ElementValueContent<
  TSchema extends WebenvSchema,
  TElement extends TComponent['elements'][keyof TComponent['elements']],
  TIsOptional extends boolean,
  TComponent extends Component = Component,
> = TElement extends { translate: true }
  ? TIsOptional extends true
    ? OptionalTranslatedContent<TSchema, ElementContent<TElement>>
    : TranslatedContent<TSchema, ElementContent<TElement>>
  : ElementContent<TElement>

type OptionalElementKeys<TComponent extends Component> = {
  [TKey in keyof TComponent['elements']]-?:
  TComponent['elements'][TKey] extends { optional: true } ? TKey : never
}[keyof TComponent['elements']]

type RequiredElementKeys<TComponent extends Component> = Exclude<
  keyof TComponent['elements'],
  OptionalElementKeys<TComponent>
>

type ComponentContent<
  TSchema extends WebenvSchema,
  TComponent extends Component,
> = ElementContentMetadata & {
  [TKey in RequiredElementKeys<TComponent>]: ElementValueContent<TSchema, TComponent['elements'][TKey], false, TComponent>
} & {
  [TKey in OptionalElementKeys<TComponent>]?: ElementValueContent<TSchema, TComponent['elements'][TKey], true, TComponent>
}

export type WebenvContent<
  TSchema extends WebenvSchema,
  TComponentName extends keyof TSchema['components'],
> = Array<ComponentContent<TSchema, TSchema['components'][TComponentName]>>
