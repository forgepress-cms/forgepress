import type { ColumnDef } from '@tanstack/vue-table'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import { h } from 'vue'

export type Column<TRow> = ColumnDef<TRow, any>

export function selectionColumn<TRow>(describe: (row: TRow) => string): Column<TRow> {
  return {
    id: 'select',
    header: ({ table }) => h(UCheckbox, {
      'modelValue': table.getIsSomeRowsSelected() ? 'indeterminate' : table.getIsAllRowsSelected(),
      'onUpdate:modelValue': (value: unknown) => table.toggleAllRowsSelected(!!value),
      'aria-label': 'Select all entries',
    }),
    cell: ({ row }) => h(UCheckbox, {
      'modelValue': row.getIsSelected(),
      'onUpdate:modelValue': (value: unknown) => row.toggleSelected(!!value),
      'aria-label': `Select ${describe(row.original)}`,
    }),
  }
}

export function dragColumn<TRow>(): Column<TRow> {
  return {
    id: 'drag',
    header: '',
    meta: { class: { th: 'w-0', td: 'w-0 pr-0' } },
  }
}

export function actionsColumn<TRow>(): Column<TRow> {
  return {
    id: 'actions',
    header: '',
    meta: { class: { th: 'sticky right-0 w-0 bg-sheet', td: 'sticky right-0 w-0 bg-sheet text-right' } },
  }
}
