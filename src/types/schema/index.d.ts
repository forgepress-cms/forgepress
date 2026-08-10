import type { ElementType } from '../../elements'
import type { ElementContentMetadata } from '../core/element'

export interface ElementSummary {
  key: string
  label: string
  element: ElementType
  targets: string[]
  translate: boolean
  optional: boolean
  multiple: boolean
}

export interface RelationEdge {
  from: string
  to: string
  element: string
  kind: 'relation' | 'dynamic'
}

export interface SchemaIssue {
  level: 'error' | 'warning'
  component: string
  element?: string
  message: string
}

export interface ComponentSummary {
  name: string
  label: string
  description?: string
  file: string
  elements: ElementSummary[]
  references: RelationEdge[]
  referencedBy: RelationEdge[]
  rows: number
  status: Record<ElementContentMetadata['status'], number>
  translated: number
  optional: number
  updatedAt?: string
}

export interface SchemaOverview {
  locales: string[]
  components: ComponentSummary[]
  edges: RelationEdge[]
  issues: SchemaIssue[]
  totals: {
    components: number
    elements: number
    rows: number
    relations: number
  }
}
