import type { ComputedRef, Ref } from 'vue'
import type { FormField } from '../utils/schema'
import { computed, ref, watch } from 'vue'

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
  const storageKey = `forgepress:columns:${key}`

  const visibility = ref<Record<string, boolean>>(restore())

  function restore(): Record<string, boolean> {
    try {
      const stored = localStorage.getItem(storageKey)

      if (stored)
        return JSON.parse(stored) as Record<string, boolean>
    }
    catch {
    }

    const shown = fields
      .filter(field => !hidden.includes(field.key))
      .slice(0, PREVIEW_COLUMNS)
      .map(field => field.key)

    return Object.fromEntries(fields.map(field => [field.key, shown.includes(field.key)]))
  }

  watch(visibility, (current) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(current))
    }
    catch {
    }
  }, { deep: true })

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
