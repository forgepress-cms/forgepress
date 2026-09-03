<script setup lang="ts">
import type { ContentRow } from '../../../../types/content/reader'
import type { Column } from '../../../utils/table'

import UBadge from '@nuxt/ui/components/Badge.vue'
import { computed, h, ref } from 'vue'

import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import DataTable from '../../../components/DataTable.vue'
import DragHandle from '../../../components/DragHandle.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import { useColumnVisibility } from '../../../composables/useColumnVisibility'
import { useComponent } from '../../../composables/useComponent'
import { useContent } from '../../../composables/useContent'
import { useDragOrder } from '../../../composables/useDragOrder'
import { useEntries } from '../../../composables/useEntries'
import { useParam } from '../../../composables/useParam'
import { useRouter } from '../../../composables/useRouter'
import { useSave } from '../../../composables/useSave'
import { clamp, fieldCell } from '../../../utils/cells'
import { entryLabel, statusColor, titleField } from '../../../utils/entry'
import { localized } from '../../../utils/preview'
import { actionsColumn, dragColumn, selectionColumn } from '../../../utils/table'

const { navigate, href } = useRouter()

const { store } = useContent()

const name = useParam('component')

const { component, locales, fields } = await useComponent(name)

const rows = ref(await store.list(name))
const locale = locales[0]

const primary = titleField(fields)

const entries = await useEntries()

function label(row: ContentRow): string {
  return entryLabel(row, primary, locale)
}

const { visibility, items } = useColumnVisibility(name, fields, primary ? [primary.key] : [])

const order = useDragOrder(move)

const columns: Column<ContentRow>[] = [
  dragColumn(),
  selectionColumn(label),
  {
    id: 'entry',
    header: 'Entry',
    cell: ({ row }) => clamp(label(row.original)),
    meta: { class: { td: 'font-medium text-highlighted' } },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => h(UBadge, {
      label: String(row.original.status),
      color: statusColor(row.original.status),
      variant: 'subtle',
    }),
  },
  ...fields.map(field => ({
    accessorKey: field.key,
    header: field.label,
    cell: ({ row }: { row: { original: ContentRow } }) =>
      fieldCell(field, localized(row.original[field.key], field.translated ? locale : undefined), entries),
  })),
  actionsColumn(),
]

const rowSelection = ref<Record<string, boolean>>({})

const selected = computed(() => Object.keys(rowSelection.value).filter(id => rowSelection.value[id]))

function clear(): void {
  rowSelection.value = {}
}

const removing = ref<string[]>([])

const { saving, error, save } = useSave()

function write(): Promise<boolean> {
  return save(() => store.writeContent(name, rows.value))
}

async function move(id: string, offset: number): Promise<void> {
  const from = rows.value.findIndex(row => row.id === id)
  const to = from + offset

  if (from < 0 || to < 0 || to >= rows.value.length)
    return

  const previous = [...rows.value]

  rows.value.splice(to, 0, ...rows.value.splice(from, 1))

  if (!await write())
    rows.value.splice(0, rows.value.length, ...previous)
}

async function remove(): Promise<void> {
  const ids = new Set(removing.value)
  const previous = [...rows.value]

  rows.value.splice(0, rows.value.length, ...previous.filter(row => !ids.has(String(row.id))))

  if (await write()) {
    removing.value = []
    clear()
  }
  else {
    rows.value.splice(0, rows.value.length, ...previous)
  }
}
</script>

<template>
  <div class="grid gap-6">
    <PageHeader
      :title="component.label ?? name"
      :description="component.description"
      :breadcrumb="[{ label: 'Content', to: href('content') }]"
    >
      <template #actions>
        <UDropdownMenu :items="items" :content="{ align: 'end' }">
          <UButton label="Columns" icon="i-lucide-columns-3" color="neutral" variant="outline" />
        </UDropdownMenu>

        <UButton label="New entry" icon="i-lucide-plus" @click="navigate(`content/${name}/new`)" />
      </template>
    </PageHeader>

    <ErrorAlert title="The entries could not be saved" :error="error" />

    <div v-if="selected.length" class="flex items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2.5">
      <span class="text-sm text-muted">
        {{ selected.length }} {{ selected.length === 1 ? 'entry' : 'entries' }} selected
      </span>

      <div class="flex items-center gap-2">
        <UButton label="Delete" color="error" variant="ghost" :loading="saving" @click="removing = selected" />

        <UButton label="Clear" color="neutral" variant="ghost" @click="clear()" />
      </div>
    </div>

    <DataTable
      v-model:row-selection="rowSelection"
      v-model:column-visibility="visibility"
      :data="rows"
      :columns="columns"
      :row-id="row => String(row.id)"
      :row-class="row => order.rowClass(row.index, String(row.original.id))"
      :empty="`No ${name} entries yet`"
      @select="row => navigate(`content/${name}/${row.id}`)"
    >
      <template #drag-cell="{ row }">
        <DragHandle @pointerdown="order.start(String(row.original.id), row.index, $event)" />
      </template>

      <template #actions-cell="{ row }">
        <div class="flex items-center justify-end">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            :aria-label="`Edit ${label(row.original)}`"
            @click="navigate(`content/${name}/${row.original.id}`)"
          />

          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            :aria-label="`Delete ${label(row.original)}`"
            @click="removing = [String(row.original.id)]"
          />
        </div>
      </template>
    </DataTable>

    <ConfirmDialog
      :open="!!removing.length"
      :title="removing.length === 1 ? 'Delete entry' : 'Delete entries'"
      :description="`${removing.length} ${removing.length === 1 ? 'entry is' : 'entries are'} removed from the content file. This cannot be undone.`"
      @update:open="removing = []"
      @confirm="remove()"
    />
  </div>
</template>
