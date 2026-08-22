<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

import { source } from '../../../content/source'
import { useRouter } from '../../router'

interface ComponentRow {
  id: string
  name: string
  description: string
  fields: number
}

const { navigate } = useRouter()

const schema = await source.schema()

const components: ComponentRow[] = Object.entries(schema.components).map(([name, component]) => ({
  id: name,
  name: component.label ?? name,
  description: component.description ?? '',
  fields: Object.keys(component.elements).length,
}))

const columns: TableColumn<ComponentRow>[] = [
  { accessorKey: 'name', header: 'Component' },
  { accessorKey: 'description', header: 'Description' },
  { accessorKey: 'fields', header: 'Fields' },
]
</script>

<template>
  <div>
    <h1 class="text-xl lg:text-2xl mb-4 font-semibold text-highlighted">
      Schema
    </h1>

    <p class="lg:text-lg mb-12">
      The content schema defines the structure of your content.<br>
      You can view and edit the components that make up your content here.
    </p>

    <UTable
      :data="components"
      :columns="columns"
      empty="No components in the schema"
      class="rounded-lg border border-default bg-default"
      @select="(_, row) => navigate(`schema/${row.original.id}`)"
    />
  </div>
</template>
