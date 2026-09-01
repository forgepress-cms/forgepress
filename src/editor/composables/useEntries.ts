import type { ContentRow } from '../../types/content/reader'
import type { Field } from '../utils/schema'
import { source } from '../../content/source'
import { entryLabel, statusColor, titleField } from '../utils/entry'
import { toFields } from '../utils/schema'

export interface EntryOption {
  label: string
  value: string
  chip: { color: 'neutral' | 'success' | 'warning' }
}

export interface Entries {
  options: (component: string) => EntryOption[]
  label: (component: string, id: unknown) => string
  componentLabel: (component: string) => string
  fields: (component: string) => Field[]
}

export async function useEntries(): Promise<Entries> {
  const schema = await source.schema()
  const locales = schema.locales ?? []

  const loaded = await Promise.all(Object.entries(schema.components).map(async ([name, component]) => {
    const title = titleField(toFields(component, locales))
    const rows: ContentRow[] = await source.list(name)

    return [name, rows.map(row => ({
      value: String(row.id),
      label: entryLabel(row, title, locales[0]),
      chip: { color: statusColor(row.status) },
    }))] as const
  }))

  const index = new Map(loaded)

  return {
    options: component => index.get(component) ?? [],
    label: (component, id) => index.get(component)?.find(option => option.value === id)?.label ?? String(id ?? ''),
    componentLabel: component => schema.components[component]?.label ?? component,
    fields: (component) => {
      const found = schema.components[component]

      return found ? toFields(found, locales) : []
    },
  }
}
