<script setup lang="ts">
import type { ContentRow } from '../../../../types/content/reader'
import type { FormField } from '../../../utils/schema'
import type { Column } from '../../../utils/table'

import { computed, reactive, ref } from 'vue'

import { RESERVED_FIELDS } from '../../../../content/validate/schema'
import { fieldTypeNames, fieldTypes } from '../../../../fields'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import DataTable from '../../../components/DataTable.vue'
import DragHandle from '../../../components/DragHandle.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import { useContent } from '../../../composables/useContent'
import { useDragOrder } from '../../../composables/useDragOrder'
import { useParam } from '../../../composables/useParam'
import { useRouter } from '../../../composables/useRouter'
import { useSchema } from '../../../composables/useSchema'
import { flag } from '../../../utils/cells'
import { KEY_PATTERN, moveKey, seedField, toFields, toKey } from '../../../utils/schema'
import { actionsColumn, dragColumn } from '../../../utils/table'

const { navigate, href } = useRouter()

const { store } = useContent()

const name = useParam('collection')

const { schema, saving, error, write } = await useSchema()

if (!schema.value.collections[name]) {
  throw new Error(`[forgepress] ${name} is not in the schema`)
}

const collection = computed(() => schema.value.collections[name]!)
const fields = computed(() => toFields(collection.value, schema.value.locales ?? []))

const order = useDragOrder(move)

const columns: Column<FormField>[] = [
  dragColumn<FormField>(),
  { accessorKey: 'key', header: 'FormField' },
  { accessorKey: 'label', header: 'Label' },
  { accessorKey: 'typeLabel', header: 'Type' },
  { accessorKey: 'optional', header: 'Required', cell: ({ row }) => flag(!row.original.optional) },
  { accessorKey: 'translated', header: 'Translated', cell: ({ row }) => flag(row.original.translated) },
  actionsColumn(),
]

const typeItems = fieldTypeNames.map(type => ({ label: fieldTypes[type].label, value: type }))

const creating = ref(false)
const removing = ref('')

const form = reactive({ label: '', key: '', type: fieldTypeNames[0]!, touched: false })

const invalid = computed(() => {
  if (!form.key)
    return 'A key is required'

  if (!KEY_PATTERN.test(form.key))
    return 'A key has to start with a letter and hold only letters, digits or underscores'

  if (RESERVED_FIELDS.includes(form.key))
    return `${form.key} is reserved for entry metadata`

  if (Object.keys(collection.value.fields).includes(form.key))
    return `${form.key} already exists`

  return ''
})

function open(): void {
  form.label = ''
  form.key = ''
  form.type = fieldTypeNames[0]!
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
    const target = draft.collections[name]!.fields as Record<string, unknown>

    target[key] = { ...seedField(form.type, Object.keys(draft.collections)), label: form.label || key, optional: true }
  })

  if (written) {
    creating.value = false
    navigate(`schema/${name}/${key}`)
  }
}

async function remove(): Promise<void> {
  const key = removing.value
  const rows = await store.list(name)
  const stripped = rows.map(({ [key]: _, ...rest }) => rest as ContentRow)

  const written = await write((draft) => {
    delete draft.collections[name]!.fields[key]
  }, async () => {
    if (rows.some(row => key in row))
      await store.writeContent(name, stripped)
  })

  if (!written)
    return

  rows.splice(0, rows.length, ...stripped)
  removing.value = ''
}

function move(key: string, offset: number): Promise<boolean> {
  return write((draft) => {
    draft.collections[name]!.fields = moveKey(draft.collections[name]!.fields, key, offset)
  })
}
</script>

<template>
  <div class="grid gap-6">
    <PageHeader
      :title="collection.label ?? name"
      :description="collection.description"
      :breadcrumb="[{ label: 'Schema', to: href('schema') }]"
    >
      <template #actions>
        <UButton label="New field" icon="i-lucide-plus" :loading="saving" @click="open()" />
      </template>
    </PageHeader>

    <ErrorAlert title="The schema could not be saved" :error="error" />

    <DataTable
      :data="fields"
      :columns="columns"
      :row-id="field => field.key"
      :row-class="row => order.rowClass(row.index, row.original.key)"
      :empty="`${collection.label ?? name} has no fields`"
      @select="field => navigate(`schema/${name}/${field.key}`)"
    >
      <template #drag-cell="{ row }">
        <DragHandle @pointerdown="order.start(row.original.key, row.index, $event)" />
      </template>

      <template #key-cell="{ row }">
        <span class="font-medium text-highlighted">{{ row.original.key }}</span>
      </template>

      <template #typeLabel-cell="{ row }">
        <UBadge :label="row.original.typeLabel" :icon="row.original.icon" color="neutral" variant="subtle" />
      </template>

      <template #optional-cell="{ row }">
        <UIcon
          :name="row.original.optional ? 'i-lucide-minus' : 'i-lucide-check'"
          :class="row.original.optional ? 'size-4 text-dimmed' : 'size-4 text-primary'"
        />
      </template>

      <template #translated-cell="{ row }">
        <UIcon
          :name="row.original.translated ? 'i-lucide-check' : 'i-lucide-minus'"
          :class="row.original.translated ? 'size-4 text-primary' : 'size-4 text-dimmed'"
        />
      </template>

      <template #actions-cell="{ row }">
        <div class="flex items-center justify-end">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            :aria-label="`Edit ${row.original.key}`"
            @click.stop="navigate(`schema/${name}/${row.original.key}`)"
          />

          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            :aria-label="`Delete ${row.original.key}`"
            @click.stop="removing = row.original.key"
          />
        </div>
      </template>
    </DataTable>

    <UModal v-model:open="creating" title="New field" :description="`A new field on ${collection.label ?? name}.`">
      <template #body>
        <div class="grid gap-4">
          <UFormField label="Name">
            <UInput :model-value="form.label" class="w-full" @update:model-value="rename(String($event))" />
          </UFormField>

          <UFormField label="Key" description="How the field is referenced in queries and content files.">
            <UInput v-model="form.key" class="w-full font-mono" @update:model-value="form.touched = true" />
          </UFormField>

          <UFormField label="Type">
            <USelect v-model="form.type" :items="typeItems" value-key="value" class="w-full" />
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
      title="Delete field"
      :description="`${removing} is removed from ${collection.label ?? name}, along with its content.`"
      @update:open="removing = ''"
      @confirm="remove()"
    />
  </div>
</template>
