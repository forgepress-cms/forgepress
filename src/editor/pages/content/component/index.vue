<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ContentRow } from '../../../../types/content/reader'

import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import { computed, h, ref } from 'vue'
import { source } from '../../../../content/source'
import { useRouter } from '../../../router'

const { route, navigate } = useRouter()

const name = route.value.params.component

if (!name) {
  throw new Error('Component name is required')
}

const schema = await source.schema()
const component = schema.components[name]

if (!component) {
  throw new Error(`Component ${name} is not in the schema`)
}

const rows = await source.list(name)

/** Content values can be objects (translations, rich elements), which the table cannot print as-is. */
function display(value: unknown): string {
  if (value === undefined || value === null || value === '')
    return '—'

  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

const columns: TableColumn<ContentRow>[] = [
  {
    id: 'select',
    header: ({ table }) => h(UCheckbox, {
      'modelValue': table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected(),
      'onUpdate:modelValue': (value: unknown) => table.toggleAllPageRowsSelected(!!value),
      'aria-label': 'Select all entries',
    }),
    cell: ({ row }) => h(UCheckbox, {
      'modelValue': row.getIsSelected(),
      'onUpdate:modelValue': (value: unknown) => row.toggleSelected(!!value),
      'aria-label': `Select ${row.original.id}`,
    }),
  },
  { accessorKey: 'id', header: 'Id' },
  ...Object.keys(component.elements).map(key => ({
    accessorKey: key,
    header: key,
    cell: ({ row }: { row: { original: ContentRow } }) => display(row.original[key]),
  })),
]

const rowSelection = ref<Record<string, boolean>>({})

const selected = computed(() => Object.keys(rowSelection.value).filter(id => rowSelection.value[id]))

function clear(): void {
  rowSelection.value = {}
}
</script>

<template>
  <div class="grid gap-4">
    <h1 class="text-xl font-semibold text-highlighted">
      {{ component.label ?? name }}
    </h1>

    <div v-if="selected.length" class="flex items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5">
      <span class="text-sm text-muted">
        {{ selected.length }} {{ selected.length === 1 ? 'entry' : 'entries' }} selected
      </span>

      <UButton label="Clear" color="neutral" variant="ghost" @click="clear()" />
    </div>

    <UTable
      v-model:row-selection="rowSelection"
      :data="rows"
      :columns="columns"
      :get-row-id="row => String(row.id)"
      :empty="`No ${name} entries yet`"
      class="rounded-lg border border-default bg-default"
      @select="(_, row) => navigate(`content/${name}/${row.original.id}`)"
    />
  </div>
</template>
