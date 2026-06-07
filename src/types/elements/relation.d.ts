import type { Element } from '../core/element'

export interface RelationElement extends Element {
  type: 'relation'
  relation: {
    component: string
    multiple?: boolean
  }
}

export interface RelationElementInput {
  ids: string[]
}
