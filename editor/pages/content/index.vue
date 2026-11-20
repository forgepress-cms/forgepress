<script setup lang="ts">
import type { Column } from '../../components'

import UBadge from '@nuxt/ui/components/Badge.vue'
import { h } from 'vue'

import { clamp, DataTable, PageHeader } from '../../components'
import { useContent, useIssues, useRouter } from '../../composables'

interface CollectionRow {
  id: string
  name: string
  description: string
  entries: number
  problems: number
  path: string
}

const { navigate } = useRouter()

const { store } = useContent()

const schema = await store.schema()
const issues = await useIssues()

const collections: CollectionRow[] = await Promise.all(Object.entries(schema.collections).map(async ([name, collection]) => {
  const rows = await store.list(name)

  return {
    id: name,
    name: collection.label ?? name,
    description: collection.description ?? '',
    entries: rows.length,
    problems: issues.count(name),
    path: collection.single && rows.length < 2 ? `content/${name}/${rows[0]?.id ?? 'new'}` : `content/${name}`,
  }
}))

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
      @select="row => navigate(row.path)"
    />
  </div>
</template>
