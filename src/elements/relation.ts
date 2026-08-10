import type { ElementDefinition, ElementOf } from '../types/core/element'

const relation = {
  type: 'relation',
  label: 'Relation',
  options: {
    component: { label: 'Component', type: 'component', required: true },
    multiple: { label: 'Multiple', type: 'boolean' },
  },
} as const satisfies ElementDefinition

export type RelationElement = ElementOf<typeof relation>

export type RelationElementContent<TElement extends RelationElement> = TElement['multiple'] extends true ? string[] : string

export default relation
