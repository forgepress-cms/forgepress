import type { ElementDefinition, ElementOf } from '../types/core/element'

const dynamic = {
  type: 'dynamic',
  label: 'Dynamic',
  options: {
    components: { label: 'Components', type: 'components', required: true },
  },
} as const satisfies ElementDefinition

export type DynamicElement = ElementOf<typeof dynamic>

interface DynamicContentItem<TComponentName extends string> {
  type: TComponentName
  component: string
}

export type DynamicElementContent<TElement extends DynamicElement>
  = DynamicContentItem<TElement['components'][number]>[]

export default dynamic
