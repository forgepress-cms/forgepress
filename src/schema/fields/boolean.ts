import type { FieldOf, FieldTypeDefinition } from './types'

const boolean = {
  type: 'boolean',
  label: 'Boolean',
  without: ['optional'],
  options: {
    default: { label: 'On by default', type: 'boolean', description: 'The value new entries start with, and the one existing entries get when the field is added.' },
    index: { label: 'Indexed', type: 'boolean', description: 'Listed in the collection manifest, so queries can filter and sort on it without loading every entry.' },
  },
} as const satisfies FieldTypeDefinition

export type BooleanField = FieldOf<typeof boolean>

export type BooleanFieldContent = boolean

export default boolean
