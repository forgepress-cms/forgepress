<script setup lang="ts">
import type { ContentRow } from '../../../../types/entry'
import type { Column } from '../../../utils/table'

import UBadge from '@nuxt/ui/components/Badge.vue'
import { computed, h, ref } from 'vue'

import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import DataTable from '../../../components/DataTable.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import { useCollection } from '../../../composables/useCollection'
import { useColumnVisibility } from '../../../composables/useColumnVisibility'
import { useContent } from '../../../composables/useContent'
import { useEntries } from '../../../composables/useEntries'
import { useParam } from '../../../composables/useParam'
import { useRouter } from '../../../composables/useRouter'
import { useSave } from '../../../composables/useSave'
import { clamp, fieldCell } from '../../../utils/cells'
import { entryLabel, statusColor, titleField } from '../../../utils/entry'
import { localized } from '../../../utils/preview'
import { actionsColumn, selectionColumn } from '../../../utils/table'

const { navigate, href } = useRouter()

const { store } = useContent()

const name = useParam('collection')

const { collection, locales, fields } = await useCollection(name)

const rows = ref(await store.list(name))
const locale = locales[0]

const primary = titleField(fields)

const entries = await useEntries()

function label(row: ContentRow): string {
  return entryLabel(row, primary, locale)
}

const { visibility, items } = useColumnVisibility(name, fields, primary ? [primary.key] : [])

const columns: Column<ContentRow>[] = [
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

async function remove(): Promise<void> {
  const ids = [...new Set(removing.value)]
  const previous = [...rows.value]

  rows.value.splice(0, rows.value.length, ...previous.filter(row => !ids.includes(String(row.id))))

  const removed = await save(async () => {
    for (const id of ids)
      await store.removeEntry(name, id)
  })

  if (removed) {
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
      :title="collection.label ?? name"
      :description="collection.description"
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
      :empty="`No ${name} entries yet`"
      @select="row => navigate(`content/${name}/${row.id}`)"
    >
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
