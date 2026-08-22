<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ElementType } from '../../../../elements'
import type { ElementOption } from '../../../../types/core/element'

import { source } from '../../../../content/source'
import { elements } from '../../../../elements'
import { useRouter } from '../../../router'

interface FieldRow {
  id: string
  key: string
  label: string
  type: ElementType['type']
  typeLabel: string
  required: boolean
  translate: boolean
}

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

const fields: FieldRow[] = Object.entries(component.elements).map(([key, element]) => ({
  id: key,
  key,
  label: element.label ?? key,
  type: element.type,
  typeLabel: elements[element.type].label,
  required: !element.optional,
  translate: element.translate ?? false,
}))

const columns: TableColumn<FieldRow>[] = [
  { accessorKey: 'key', header: 'Field' },
  { accessorKey: 'label', header: 'Label' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'required', header: 'Required' },
  { accessorKey: 'translate', header: 'Translated' },
]
</script>

<template>
  <div class="grid gap-4">
    <div class="flex items-center gap-6 mb-4">
      <button
        class="text-xl lg:text-2xl font-semibold text-highlighted cursor-pointer"
        @click="navigate(`schema`)"
      >
        Schema
      </button>

      <h2 class="text-lg lg:text-xl pt-1 font-semibold text-highlighted">
        {{ component.label ?? name }}
      </h2>
    </div>

    <p v-if="component.description" class="lg:text-lg">
      {{ component.description }}
    </p>

    <UTable
      :data="fields"
      :columns="columns"
      :empty="`${component.label ?? name} has no fields`"
      class="rounded-lg border border-default bg-default"
    >
      <template #key-cell="{ row }">
        <span class="font-medium text-highlighted">{{ row.original.key }}</span>
      </template>

      <template #type-cell="{ row }">
        <UBadge :label="row.original.typeLabel" :title="row.original.type" color="neutral" variant="subtle" />
      </template>

      <template #required-cell="{ row }">
        <UIcon
          :name="row.original.required ? 'i-lucide-check' : 'i-lucide-minus'"
          :class="row.original.required ? 'size-4 text-primary' : 'size-4 text-dimmed'"
        />
      </template>

      <template #translate-cell="{ row }">
        <UIcon
          :name="row.original.translate ? 'i-lucide-check' : 'i-lucide-minus'"
          :class="row.original.translate ? 'size-4 text-primary' : 'size-4 text-dimmed'"
        />
      </template>
    </UTable>
  </div>
</template>
