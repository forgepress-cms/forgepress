<script setup lang="ts">
import type { Column } from '../../utils/table'
import { computed, ref } from 'vue'

import { isCollectionName } from '../../../src/files/paths'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import CreateDialog from '../../components/CreateDialog.vue'
import DataTable from '../../components/DataTable.vue'
import DragHandle from '../../components/DragHandle.vue'
import ErrorAlert from '../../components/ErrorAlert.vue'
import PageHeader from '../../components/layout/PageHeader.vue'
import { useDragOrder } from '../../composables/useDragOrder'
import { useRouter } from '../../composables/useRouter'
import { useSchema } from '../../composables/useSchema'
import { clamp } from '../../utils/cells'
import { moveKey } from '../../utils/order'
import { actionsColumn, dragColumn } from '../../utils/table'

interface CollectionRow {
  key: string
  name: string
  description: string
  fields: number
}

const { navigate } = useRouter()

const { schema, saving, error, write } = await useSchema()

const collections = computed<CollectionRow[]>(() => Object.entries(schema.value.collections).map(([key, collection]) => ({
  key,
  name: collection.label ?? key,
  description: collection.description ?? '',
  fields: Object.keys(collection.fields).length,
})))

const order = useDragOrder(move)

const columns: Column<CollectionRow>[] = [
  dragColumn<CollectionRow>(),
  { accessorKey: 'name', header: 'Collection' },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => clamp(row.original.description, 'max-w-96'),
  },
  { accessorKey: 'fields', header: 'Fields' },
  actionsColumn(),
]

const creating = ref(false)
const removing = ref('')

function invalid(key: string): string {
  if (!key)
    return 'A key is required'

  if (!isCollectionName(key))
    return 'A key has to start with a lowercase letter and hold only letters and digits'

  if (Object.hasOwn(schema.value.collections, key))
    return `${key} already exists`

  return ''
}

async function create(label: string, key: string): Promise<void> {
  const written = await write((draft) => {
    draft.collections[key] = { label: label || key, fields: {} }
  })

  if (written) {
    creating.value = false
    navigate(`schema/${key}`)
  }
}

const references = computed(() => Object.entries(schema.value.collections)
  .filter(([key, collection]) => key !== removing.value && Object.values(collection.fields).some(config =>
    ('collection' in config && config.collection === removing.value)
    || ('collections' in config && config.collections?.includes(removing.value)),
  ))
  .map(([key, collection]) => collection.label ?? key))

async function remove(): Promise<void> {
  const key = removing.value

  const written = await write((draft) => {
    delete draft.collections[key]
  }, writer => writer.removeCollection(key))

  if (written)
    removing.value = ''
}

function move(key: string, offset: number): Promise<boolean> {
  return write((draft) => {
    draft.collections = moveKey(draft.collections, key, offset)
  })
}
</script>

<template>
  <div class="grid gap-8">
    <PageHeader title="Schema" description="The collections that make up your content, and the fields they hold.">
      <template #actions>
        <UButton label="New collection" icon="i-hugeicons-plus-sign" :loading="saving" @click="creating = true" />
      </template>
    </PageHeader>

    <ErrorAlert title="The schema could not be saved" :error="error" />

    <DataTable
      :data="collections"
      :columns="columns"
      :row-id="row => row.key"
      :row-class="row => order.rowClass(row.index, row.original.key)"
      empty="No collections in the schema"
      @select="row => navigate(`schema/${row.key}`)"
    >
      <template #drag-cell="{ row }">
        <DragHandle @pointerdown="order.start(row.original.key, row.index, $event)" />
      </template>

      <template #actions-cell="{ row }">
        <div class="flex items-center justify-end">
          <UButton
            icon="i-hugeicons-delete-02"
            color="error"
            variant="ghost"
            class="text-default hover:text-error focus-visible:text-error"
            :aria-label="`Delete ${row.original.name}`"
            @click.stop="removing = row.original.key"
          />
        </div>
      </template>
    </DataTable>

    <CreateDialog
      v-model:open="creating"
      title="New collection"
      description="Collections describe one kind of content entry."
      key-description="How the collection is referenced in queries and content files."
      :loading="saving"
      :validate="invalid"
      @create="create"
    />

    <ConfirmDialog
      :open="!!removing"
      title="Delete collection"
      :description="references.length
        ? `${removing} can't be deleted while ${references.join(', ')} still reference it. Remove those references first.`
        : `${removing} and its content file are removed. This cannot be undone.`"
      :disabled="references.length > 0"
      @update:open="removing = ''"
      @confirm="remove()"
    />
  </div>
</template>
