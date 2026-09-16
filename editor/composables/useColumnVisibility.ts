import type { ComputedRef, Ref } from 'vue'
import type { FormField } from '../utils/schema'
import { noop, useStorage } from '@vueuse/core'
import { computed } from 'vue'

const PREVIEW_COLUMNS = 3

export interface ColumnItem {
  type: 'checkbox'
  label: string
  checked: boolean
  onUpdateChecked: (checked: boolean) => void
  onSelect: (event: Event) => void
}

export interface ColumnVisibility {
  visibility: Ref<Record<string, boolean>>
  items: ComputedRef<ColumnItem[]>
}

export function useColumnVisibility(key: string, fields: FormField[], hidden: string[] = []): ColumnVisibility {
  const shown = fields
    .filter(field => !hidden.includes(field.key))
    .slice(0, PREVIEW_COLUMNS)
    .map(field => field.key)

  const visibility = useStorage<Record<string, boolean>>(
    `forgepress:columns:${key}`,
    Object.fromEntries(fields.map(field => [field.key, shown.includes(field.key)])),
    undefined,
    { writeDefaults: false, onError: noop },
  )

  const items = computed<ColumnItem[]>(() => fields.map(field => ({
    type: 'checkbox',
    label: field.label,
    checked: visibility.value[field.key] !== false,
    onUpdateChecked: (checked: boolean) => {
      visibility.value = { ...visibility.value, [field.key]: checked }
    },
    onSelect: (event: Event) => event.preventDefault(),
  })))

  return { visibility, items }
}
