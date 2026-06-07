import type { Component } from './core/component'
import type { ElementInput } from './elements'

export interface WebenvSchema {
  components: Record<string, Component>
}

type OptionalElementKeys<TComponent extends Component> = {
  [TKey in keyof TComponent['elements']]-?:
  TComponent['elements'][TKey] extends { optional: true } ? TKey : never
}[keyof TComponent['elements']]

type RequiredElementKeys<TComponent extends Component> = Exclude<
  keyof TComponent['elements'],
  OptionalElementKeys<TComponent>
>

type ComponentInput<TComponent extends Component> = {
  [TKey in RequiredElementKeys<TComponent>]: ElementInput<TComponent['elements'][TKey]>
} & {
  [TKey in OptionalElementKeys<TComponent>]?: ElementInput<TComponent['elements'][TKey]>
}

export type WebenvContent<
  TSchema extends WebenvSchema,
  TComponentName extends keyof TSchema['components'],
> = Array<ComponentInput<TSchema['components'][TComponentName]>>
