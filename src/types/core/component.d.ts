import type { ElementType } from '../../elements'

export interface Component {
  label?: string
  description?: string
  elements: Record<string, ElementType>
}

export interface AnyComponent {
  elements: Record<string, ElementType>
}
