import type { Element } from '../types/core/element'

export interface DynamicElement extends Element {
  type: 'dynamic'
  components: readonly string[]
}

interface DynamicContentItem<TComponentName extends string> {
  type: TComponentName
  component: string
}

export type DynamicElementContent<TElement extends DynamicElement>
  = DynamicContentItem<TElement['components'][number]>[]
