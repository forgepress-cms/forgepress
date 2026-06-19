import type { ElementType } from '../../elements'
import type { Component } from './component'

type NonTranslatedElement<TElement extends ElementType = ElementType> = TElement extends ElementType
  ? Omit<TElement, 'translate'> & { translate?: false }
  : never

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

export type SchemaLocale<TSchema extends WebenvSchema>
  = TSchema['locales'] extends readonly string[] ? TSchema['locales'][number] : never
