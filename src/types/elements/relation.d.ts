import type { Element } from '../core/element'

export interface RelationElement extends Element {
  type: 'relation'
  component: string
  multiple?: boolean
}

export type RelationElementContent<TElement extends { multiple?: boolean }> = TElement['multiple'] extends true ? string[] : string
