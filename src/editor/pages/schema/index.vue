<script setup lang="ts">
import type { Column } from '../../utils/table'

import { computed, reactive, ref } from 'vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import DataTable from '../../components/DataTable.vue'
import DragHandle from '../../components/DragHandle.vue'
import ErrorAlert from '../../components/ErrorAlert.vue'
import PageHeader from '../../components/layout/PageHeader.vue'
import { useDragOrder } from '../../composables/useDragOrder'
import { useRouter } from '../../composables/useRouter'
import { useSchema } from '../../composables/useSchema'
import { clamp } from '../../utils/cells'
import { KEY_PATTERN, moveKey, toKey } from '../../utils/schema'
import { actionsColumn, dragColumn } from '../../utils/table'
import { writer } from '../../writer'

interface ComponentRow {
  key: string
  name: string
  description: string
  fields: number
}

const { navigate } = useRouter()

const { schema, saving, error, write } = await useSchema()

const components = computed<ComponentRow[]>(() => Object.entries(schema.value.components).map(([key, component]) => ({
  key,
  name: component.label ?? key,
  description: component.description ?? '',
  fields: Object.keys(component.elements).length,
})))

const order = useDragOrder(move)

const columns: Column<ComponentRow>[] = [
  dragColumn<ComponentRow>(),
  { accessorKey: 'name', header: 'Component' },
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

const form = reactive({ label: '', key: '', touched: false })

const taken = computed(() => Object.keys(schema.value.components))

const invalid = computed(() => {
  if (!form.key)
    return 'A key is required'

  if (!KEY_PATTERN.test(form.key))
    return 'A key has to start with a letter and hold only letters, digits or underscores'

  if (taken.value.includes(form.key))
    return `${form.key} already exists`

  return ''
})

function open(): void {
  form.label = ''
  form.key = ''
  form.touched = false
  creating.value = true
}

function rename(label: string): void {
  form.label = label

  if (!form.touched)
    form.key = toKey(label)
}

async function create(): Promise<void> {
  const key = form.key

  const written = await write((draft) => {
    draft.components[key] = { label: form.label || key, elements: {} }
  })

  if (written) {
    creating.value = false
    navigate(`schema/${key}`)
  }
}

const references = computed(() => Object.entries(schema.value.components)
  .filter(([key, component]) => key !== removing.value && Object.values(component.elements).some(element =>
    ('component' in element && element.component === removing.value)
    || ('components' in element && element.components?.includes(removing.value)),
  ))
  .map(([, component]) => component.label ?? ''))

async function remove(): Promise<void> {
  const key = removing.value

  const written = await write(async (draft) => {
    delete draft.components[key]
    await writer.removeContent(key)
  })

  if (written)
    removing.value = ''
}

function move(key: string, offset: number): Promise<boolean> {
  return write((draft) => {
    draft.components = moveKey(draft.components, key, offset)
  })
}
</script>

<template>
  <div class="grid gap-6">
    <PageHeader title="Schema" description="The components that make up your content, and the fields they hold.">
      <template #actions>
        <UButton label="New component" icon="i-lucide-plus" :loading="saving" @click="open()" />
      </template>
    </PageHeader>

    <ErrorAlert title="The schema could not be saved" :error="error" />

    <DataTable
      :data="components"
      :columns="columns"
      :row-id="row => row.key"
      :row-class="row => order.rowClass(row.index, row.original.key)"
      empty="No components in the schema"
      @select="row => navigate(`schema/${row.key}`)"
    >
      <template #drag-cell="{ row }">
        <DragHandle @pointerdown="order.start(row.original.key, row.index, $event)" />
      </template>

      <template #actions-cell="{ row }">
        <div class="flex items-center justify-end">
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            :aria-label="`Delete ${row.original.name}`"
            @click.stop="removing = row.original.key"
          />
        </div>
      </template>
    </DataTable>

    <UModal v-model:open="creating" title="New component" description="Components describe one kind of content entry.">
      <template #body>
        <div class="grid gap-4">
          <UFormField label="Name">
            <UInput :model-value="form.label" class="w-full" @update:model-value="rename(String($event))" />
          </UFormField>

          <UFormField label="Key" description="How the component is referenced in queries and content files.">
            <UInput v-model="form.key" class="w-full font-mono" @update:model-value="form.touched = true" />
          </UFormField>

          <p v-if="form.key && invalid" class="text-sm text-error">
            {{ invalid }}
          </p>
        </div>
      </template>

      <template #footer>
        <UButton label="Create" :loading="saving" :disabled="!!invalid" @click="create()" />

        <UButton label="Cancel" color="neutral" variant="ghost" @click="creating = false" />
      </template>
    </UModal>

    <ConfirmDialog
      :open="!!removing"
      title="Delete component"
      :description="references.length
        ? `${removing} and its content file are removed. ${references.join(', ')} still reference it.`
        : `${removing} and its content file are removed. This cannot be undone.`"
      @update:open="removing = ''"
      @confirm="remove()"
    />
  </div>
</template>
