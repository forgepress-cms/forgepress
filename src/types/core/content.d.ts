import type { ElementContentMetadata } from './element'
import type { AnyComponent } from './component'
import type { ElementContent, ElementType } from '../../elements'
import type { WebenvSchema, SchemaLocale } from './schema'

type TranslatedContent<TSchema extends WebenvSchema, TContent> =
  [SchemaLocale<TSchema>] extends [never] ? TContent : Record<SchemaLocale<TSchema>, TContent>

type OptionalTranslatedContent<TSchema extends WebenvSchema, TContent> =
  [SchemaLocale<TSchema>] extends [never] ? TContent : Partial<Record<SchemaLocale<TSchema>, TContent>>

type ElementValueContent<
  TSchema extends WebenvSchema,
  TElement extends ElementType,
  TIsOptional extends boolean,
> = TElement extends { translate: true }
  ? TIsOptional extends true
    ? OptionalTranslatedContent<TSchema, ElementContent<TElement>>
    : TranslatedContent<TSchema, ElementContent<TElement>>
  : ElementContent<TElement>

type OptionalElementKeys<TComponent extends AnyComponent> = {
  [TKey in keyof TComponent['elements']]-?:
  TComponent['elements'][TKey] extends { optional: true } ? TKey : never
}[keyof TComponent['elements']]

type RequiredElementKeys<TComponent extends AnyComponent> = Exclude<
  keyof TComponent['elements'],
  OptionalElementKeys<TComponent>
>

type ComponentContent<
  TSchema extends WebenvSchema,
  TComponent extends AnyComponent,
> = ElementContentMetadata & {
  [TKey in RequiredElementKeys<TComponent>]: ElementValueContent<TSchema, TComponent['elements'][TKey], false>
} & {
  [TKey in OptionalElementKeys<TComponent>]?: ElementValueContent<TSchema, TComponent['elements'][TKey], true>
}

type SchemaComponent<
  TSchema extends WebenvSchema,
  TComponentName extends keyof TSchema['components'],
> = TSchema['components'][TComponentName] extends AnyComponent
  ? TSchema['components'][TComponentName]
  : AnyComponent

export type WebenvContent<
  TSchema extends WebenvSchema,
  TComponentName extends keyof TSchema['components'],
> = ComponentContent<TSchema, SchemaComponent<TSchema, TComponentName>>[]
