import type { ElementContentMetadata } from './element'
import type { Component } from './component'
import type { ElementContent, ElementType } from '../elements'

type NonTranslatedElement<TElement extends ElementType = ElementType> = Omit<TElement, 'translate'> & {
  translate?: false
}

type NonTranslatedComponent<TComponent extends Component = Component> = Omit<TComponent, 'elements'> & {
  elements: {
    [TKey in keyof TComponent['elements']]: NonTranslatedElement<TComponent['elements'][TKey]>
  }
}

export type WebenvSchema = {
  components: Record<string, Component>
  locales: readonly string[]
} | {
  components: Record<string, NonTranslatedComponent>
  locales?: readonly string[]
}

export type SchemaLocale<TSchema extends WebenvSchema> =
  TSchema['locales'] extends readonly string[] ? TSchema['locales'][number] : never
