<script setup lang="ts" generic="TRow">
import type { Row, RowSelectionState, VisibilityState } from '@tanstack/vue-table'
import type { Column } from '../utils/table'

import { FlexRender, getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { useMediaQuery } from '@vueuse/core'
import { computed } from 'vue'

const props = defineProps<{
  data: TRow[]
  columns: Column<TRow>[]
  rowId: (row: TRow) => string
  empty: string
  rowClass?: (row: Row<TRow>) => string
  onSelect?: (row: TRow) => void
}>()

const LEADING = ['select', 'drag']
const TRAILING = ['actions']

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

const wide = useMediaQuery('(min-width: 48rem)')

const primary = computed(() => table.getVisibleLeafColumns().find(column => !LEADING.includes(column.id) && !TRAILING.includes(column.id))?.id)
const leading = computed(() => table.getHeaderGroups().at(-1)?.headers.find(header => LEADING.includes(header.column.id)))
const heading = computed(() => table.getHeaderGroups().at(-1)?.headers.find(header => header.column.id === primary.value)?.column.columnDef.header)

function label(header: unknown): string {
  return typeof header === 'string' ? header : ''
}

function details(row: Row<TRow>) {
  return row.getVisibleCells().filter(cell => !LEADING.includes(cell.column.id) && !TRAILING.includes(cell.column.id) && cell.column.id !== primary.value)
}
</script>

<template>
  <div class="sheet relative overflow-auto rounded-lg">
    <table v-if="wide" class="min-w-full">
      <thead>
        <tr
          v-for="group in table.getHeaderGroups()"
          :key="group.id"
          class="border-b border-default"
        >
          <th
            v-for="header in group.headers"
            :key="header.id"
            class="px-5 py-4.5 text-start font-display text-[0.9375rem] font-semibold whitespace-nowrap text-highlighted [&:has([role=checkbox])]:pe-0"
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
            class="px-5 py-4 text-sm whitespace-nowrap text-muted [&:has([role=checkbox])]:pe-0"
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

    <template v-else>
      <div class="flex items-center gap-3 border-b border-default px-4 py-3.5 font-display text-[0.9375rem] font-semibold text-highlighted">
        <span v-if="leading" class="flex min-w-4">
          <FlexRender :render="leading.column.columnDef.header" :props="leading.getContext()" />
        </span>

        {{ label(heading) }}
      </div>

      <ul data-drag class="divide-y divide-default">
        <li
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          class="grid grid-cols-1 gap-2 px-4 py-3"
          :class="[
            onSelect && 'cursor-pointer hover:bg-elevated/50',
            row.getIsSelected() && 'bg-elevated/50',
            rowClass?.(row),
          ]"
          @click="onRowClick($event, row.original)"
        >
          <div class="flex min-h-7 items-center gap-3">
            <template v-for="cell in row.getVisibleCells()" :key="cell.id">
              <label v-if="LEADING.includes(cell.column.id)" class="-m-2 flex p-2">
                <slot :name="`${cell.column.id}-cell`" :row="row">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </slot>
              </label>

              <div v-else-if="cell.column.id === primary" class="min-w-0 flex-1 text-sm font-medium text-highlighted">
                <slot :name="`${cell.column.id}-cell`" :row="row">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </slot>
              </div>

              <div v-else-if="TRAILING.includes(cell.column.id)" class="-my-1 -me-2 ms-auto shrink-0">
                <slot :name="`${cell.column.id}-cell`" :row="row">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </slot>
              </div>
            </template>
          </div>

          <dl
            v-if="details(row).length"
            class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 text-sm text-muted"
            :class="leading && 'ps-7'"
          >
            <template v-for="cell in details(row)" :key="cell.id">
              <dt class="max-w-28 truncate text-xs">
                {{ label(cell.column.columnDef.header) }}
              </dt>

              <dd class="min-w-0">
                <slot :name="`${cell.column.id}-cell`" :row="row">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </slot>
              </dd>
            </template>
          </dl>
        </li>

        <li v-if="!table.getRowModel().rows.length" class="px-4 py-6 text-center text-sm text-muted">
          {{ empty }}
        </li>
      </ul>
    </template>
  </div>
</template>
