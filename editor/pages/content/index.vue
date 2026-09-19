<script setup lang="ts">
import type { Column } from '../../utils/table'

import UBadge from '@nuxt/ui/components/Badge.vue'
import { h } from 'vue'

import DataTable from '../../components/DataTable.vue'
import PageHeader from '../../components/layout/PageHeader.vue'
import { useContent } from '../../composables/useContent'
import { useIssues } from '../../composables/useIssues'
import { useRouter } from '../../composables/useRouter'
import { clamp } from '../../utils/cells'

interface CollectionRow {
  id: string
  name: string
  description: string
  entries: number
  problems: number
}

const { navigate } = useRouter()

const { store } = useContent()

const schema = await store.schema()
const issues = await useIssues()

const collections: CollectionRow[] = await Promise.all(Object.entries(schema.collections).map(async ([name, collection]) => ({
  id: name,
  name: collection.label ?? name,
  description: collection.description ?? '',
  entries: (await store.list(name)).length,
  problems: issues.count(name),
})))

const columns: Column<CollectionRow>[] = [
  {
    accessorKey: 'name',
    header: 'Collection',
    meta: {
      class: { td: 'leading-8' },
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => clamp(row.original.description, 'max-w-96'),
  },
  {
    accessorKey: 'entries',
    header: 'Entries',
    cell: ({ row }) => row.original.problems === 0
      ? String(row.original.entries)
      : h('span', { class: 'flex items-center gap-2' }, [
          String(row.original.entries),
          h(UBadge, { icon: 'i-hugeicons-alert-02', color: 'warning', variant: 'soft', label: `${row.original.problems} with problems` }),
        ]),
  },
]
</script>

<template>
  <div class="grid gap-8">
    <PageHeader title="Content" description="Every collection in the schema. Pick one to see and edit its entries." />

    <DataTable
      :data="collections"
      :columns="columns"
      :row-id="row => row.id"
      empty="No collections in the schema"
      @select="row => navigate(`content/${row.id}`)"
    />
  </div>
</template>
