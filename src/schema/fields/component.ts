import type { ComponentItem, Listed } from './picked'
import type { FieldOf, FieldTypeDefinition } from './types'
import { COMPONENT_KEY, taggedName } from './picked'

const component = {
  type: 'component',
  label: 'Component',
  options: {
    components: { label: 'Components', type: 'components', required: true, description: 'The components content can hold. Pick more than one to let content choose.' },
    multiple: { label: 'Multiple', type: 'boolean', description: 'Content holds a list of items instead of one.' },
  },
} as const satisfies FieldTypeDefinition

export type ComponentField = FieldOf<typeof component>

export type ComponentFieldContent<TField extends ComponentField> = Listed<TField, ComponentItem>

export function itemComponent(field: ComponentField, item: unknown): string | undefined {
  return taggedName(field.components, COMPONENT_KEY, item)
}

export default component
