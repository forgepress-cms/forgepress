import type { Listed } from './picked'
import type { FieldOf, FieldTypeDefinition } from './types'

const list = {
  type: 'list',
  label: 'List',
  options: {
    values: { label: 'Values', type: 'strings', required: true, description: 'The values content picks from.' },
    multiple: { label: 'Multiple', type: 'boolean', description: 'Content picks any number of values instead of one.' },
    index: { label: 'Indexed', type: 'boolean', description: 'Listed in the collection manifest, so queries can filter and sort on it without loading every entry.' },
  },
} as const satisfies FieldTypeDefinition

export type ListField = FieldOf<typeof list>

export type ListFieldContent<TField extends ListField> = Listed<TField, TField['values'][number]>

export default list
