<script setup lang="ts">
import type { Column } from '../../utils/table'

import { h } from 'vue'
import DataTable from '../../components/DataTable.vue'
import { useContent } from '../../composables/useContent'
import { useRouter } from '../../composables/useRouter'

interface ComponentRow {
  id: string
  name: string
  description: string
  entries: number
}

const { navigate } = useRouter()

const { store } = useContent()

const schema = await store.schema()

const components: ComponentRow[] = await Promise.all(Object.entries(schema.components).map(async ([name, component]) => ({
  id: name,
  name: component.label ?? name,
  description: component.description ?? '',
  entries: (await store.list(name)).length,
})))

const columns: Column<ComponentRow>[] = [
  { accessorKey: 'name', header: 'Component' },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => h('span', { class: 'block max-w-96 truncate', title: row.original.description }, row.original.description),
  },
  { accessorKey: 'entries', header: 'Entries' },
]
</script>

<template>
  <div>
    <h1 class="text-xl lg:text-2xl mb-4 font-semibold text-highlighted">
      Content
    </h1>

    <p class="lg:text-lg mb-12">
      The content section allows you to view and manage the content entries for each component defined in the schema.<br>
      Click on a component to see its entries and details.
    </p>

    <DataTable
      :data="components"
      :columns="columns"
      :row-id="row => row.id"
      empty="No components in the schema"
      @select="row => navigate(`content/${row.id}`)"
    />
  </div>
</template>
