<script setup lang="ts" generic="TRow">
import type { Row, RowSelectionState, VisibilityState } from '@tanstack/vue-table'
import type { Column } from '../utils/table'

import { FlexRender, getCoreRowModel, useVueTable } from '@tanstack/vue-table'

const props = defineProps<{
  data: TRow[]
  columns: Column<TRow>[]
  rowId: (row: TRow) => string
  empty: string
  rowClass?: (row: Row<TRow>) => string
  onSelect?: (row: TRow) => void
}>()

function onRowClick(event: MouseEvent, row: TRow): void {
  if ((event.target as HTMLElement).closest('button, a, input, label'))
    return

  props.onSelect?.(row)
}

const rowSelection = defineModel<RowSelectionState>('rowSelection', { default: () => ({}) })
const columnVisibility = defineModel<VisibilityState>('columnVisibility', { default: () => ({}) })

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return props.columns
  },
  getRowId: row => props.rowId(row),
  getCoreRowModel: getCoreRowModel(),
  state: {
    get rowSelection() {
      return rowSelection.value
    },
    get columnVisibility() {
      return columnVisibility.value
    },
  },
  onRowSelectionChange: (updater) => {
    rowSelection.value = typeof updater === 'function' ? updater(rowSelection.value) : updater
  },
  onColumnVisibilityChange: (updater) => {
    columnVisibility.value = typeof updater === 'function' ? updater(columnVisibility.value) : updater
  },
})
</script>

<template>
  <div class="relative overflow-auto rounded-lg border border-default bg-default">
    <table class="min-w-full">
      <thead>
        <tr
          v-for="group in table.getHeaderGroups()"
          :key="group.id"
          class="border-b border-default"
        >
          <th
            v-for="header in group.headers"
            :key="header.id"
            class="px-4 py-3.5 text-start text-sm font-semibold text-highlighted [&:has([role=checkbox])]:pe-0"
            :class="header.column.columnDef.meta?.class?.th"
          >
            <FlexRender
              v-if="!header.isPlaceholder"
              :render="header.column.columnDef.header"
              :props="header.getContext()"
            />
          </th>
        </tr>
      </thead>

      <tbody data-drag class="divide-y divide-default">
        <tr
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :class="[
            onSelect && 'cursor-pointer hover:bg-elevated/50',
            row.getIsSelected() && 'bg-elevated/50',
            rowClass?.(row),
          ]"
          @click="onRowClick($event, row.original)"
        >
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            class="p-4 text-sm whitespace-nowrap text-muted [&:has([role=checkbox])]:pe-0"
            :class="cell.column.columnDef.meta?.class?.td"
          >
            <slot :name="`${cell.column.id}-cell`" :row="row">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </slot>
          </td>
        </tr>

        <tr v-if="!table.getRowModel().rows.length">
          <td :colspan="table.getVisibleLeafColumns().length" class="py-6 text-center text-sm text-muted">
            {{ empty }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
