import type { Field } from '../../fields'

export interface Collection {
  label?: string
  description?: string
  fields: Record<string, Field>
}
