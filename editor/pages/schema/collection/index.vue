<script setup lang="ts">
import type { Field } from '../../../../src/schema/fields'
import type { CollectionValues } from '../../../components/CollectionDialog.vue'
import type { FormField } from '../../../utils/schema'
import type { Column } from '../../../utils/table'

import { computed, ref } from 'vue'

import { isCollectionName } from '../../../../src/files/paths'
import { renameCollection, renameComponent } from '../../../../src/migrate/schema'
import { fieldTypeNames } from '../../../../src/schema/fields'
import { RESERVED_FIELDS } from '../../../../src/schema/validate'
import CollectionDialog from '../../../components/CollectionDialog.vue'
import CreateDialog from '../../../components/CreateDialog.vue'
import DataTable from '../../../components/DataTable.vue'
import DragHandle from '../../../components/DragHandle.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import MigrationDialog from '../../../components/MigrationDialog.vue'
import MigrationNotice from '../../../components/MigrationNotice.vue'
import { useDragOrder } from '../../../composables/useDragOrder'
import { useRouter } from '../../../composables/useRouter'
import { useSchema } from '../../../composables/useSchema'
import { groupOf, groupPath, useSchemaGroup } from '../../../composables/useSchemaGroup'
import { moveKey } from '../../../utils/order'
import { allowsOptional, FIELD_TYPE_ITEMS, KEY_PATTERN, seedField, toFields } from '../../../utils/schema'
import { actionsColumn, dragColumn } from '../../../utils/table'

const { navigate, href } = useRouter()

const group = useSchemaGroup()
const { name, kind } = group

const editor = await useSchema()
const { schema, saving, error, review, change } = editor

if (!group.definition(schema.value)) {
  throw new Error(`[forgepress] ${name} is not in the schema`)
}

const collection = computed(() => group.definition(schema.value)!)
const fields = computed(() => toFields(collection.value, schema.value.locales ?? []))

const order = useDragOrder(move)

const columns: Column<FormField>[] = [
  dragColumn<FormField>(),
  { accessorKey: 'key', header: 'Field' },
  { accessorKey: 'label', header: 'Label' },
  { accessorKey: 'typeLabel', header: 'Type' },
  { accessorKey: 'optional', header: 'Required' },
  { accessorKey: 'translated', header: 'Translated' },
  actionsColumn(),
]

const creating = ref(false)
const editing = ref(false)
const type = ref<Field['type']>(fieldTypeNames[0]!)

function invalid(key: string): string {
  if (!key)
    return 'A key is required'

  if (!KEY_PATTERN.test(key))
    return 'A key has to start with a letter and hold only letters, digits or underscores'

  if (RESERVED_FIELDS.includes(key))
    return `${key} is reserved for entry metadata`

  if (Object.hasOwn(collection.value.fields, key))
    return `${key} already exists`

  return ''
}

function open(): void {
  type.value = fieldTypeNames[0]!
  creating.value = true
}

function invalidCollection(key: string): string {
  if (!key)
    return 'A key is required'

  if (!isCollectionName(key))
    return 'A key has to start with a lowercase letter and hold only letters and digits'

  if (Object.hasOwn(groupOf(schema.value, kind), key))
    return `${key} already exists`

  return ''
}

async function create(label: string, key: string): Promise<void> {
  creating.value = false

  const written = await change((draft) => {
    const target = group.holder(draft).fields as Record<string, unknown>
    const components = Object.keys(draft.components ?? {}).filter(item => kind === 'collections' || item !== name)

    target[key] = { ...seedField(type.value, Object.keys(draft.collections), components), label: label || key, ...allowsOptional(type.value) ? { optional: true } : {} }
  })

  if (written)
    navigate(group.path(key))
}

async function edit(values: CollectionValues): Promise<void> {
  const renamed = values.key !== name

  editing.value = false

  const written = await change((draft) => {
    const { fields } = group.holder(draft)

    groupOf(draft, kind)[name] = { ...values.label ? { label: values.label } : {}, ...values.description ? { description: values.description } : {}, fields }

    if (renamed && kind === 'components')
      renameComponent(draft, name, values.key)
    else if (renamed)
      renameCollection(draft, name, values.key)
  }, renamed ? { [kind]: { [name]: values.key } } : {})

  if (written && renamed)
    navigate(groupPath(kind, values.key))
}

function remove(field: FormField): Promise<boolean> {
  return change((draft) => {
    delete group.holder(draft).fields[field.key]
  })
}

function move(key: string, offset: number): Promise<boolean> {
  return change((draft) => {
    const holder = group.holder(draft)

    holder.fields = moveKey(holder.fields, key, offset)
  })
}
</script>

<template>
  <div class="grid gap-8">
    <PageHeader
      :title="collection.label ?? name"
      :description="collection.description"
      :breadcrumb="[{ label: 'Schema', to: href('schema') }]"
    >
      <template #actions>
        <UButton label="Edit" icon="i-hugeicons-pencil-edit-02" color="neutral" variant="outline" @click="editing = true" />

        <UButton label="New field" icon="i-hugeicons-plus-sign" :loading="saving" @click="open()" />
      </template>
    </PageHeader>

    <MigrationNotice :editor="editor" />

    <ErrorAlert title="The schema could not be saved" :error="error" />

    <DataTable
      :data="fields"
      :columns="columns"
      :row-id="field => field.key"
      :row-class="row => order.rowClass(row.index, row.original.key)"
      :empty="`${collection.label ?? name} has no fields`"
      @select="field => navigate(group.path(field.key))"
    >
      <template #drag-cell="{ row }">
        <DragHandle @pointerdown="order.start(row.original.key, row.index, $event)" />
      </template>

      <template #key-cell="{ row }">
        <span class="font-medium text-highlighted">{{ row.original.key }}</span>
      </template>

      <template #typeLabel-cell="{ row }">
        <UBadge :label="row.original.typeLabel" :icon="row.original.icon" color="neutral" variant="soft" />
      </template>

      <template #optional-cell="{ row }">
        <UIcon
          :name="row.original.optional ? 'i-hugeicons-minus-sign' : 'i-hugeicons-tick-02'"
          :class="row.original.optional ? 'size-4 text-dimmed' : 'size-4 text-primary'"
        />
      </template>

      <template #translated-cell="{ row }">
        <UIcon
          :name="row.original.translated ? 'i-hugeicons-tick-02' : 'i-hugeicons-minus-sign'"
          :class="row.original.translated ? 'size-4 text-primary' : 'size-4 text-dimmed'"
        />
      </template>

      <template #actions-cell="{ row }">
        <div class="flex items-center justify-end">
          <UButton
            icon="i-hugeicons-pencil-edit-02"
            color="neutral"
            variant="ghost"
            :aria-label="`Edit ${row.original.key}`"
            @click.stop="navigate(group.path(row.original.key))"
          />

          <UButton
            icon="i-hugeicons-delete-02"
            color="error"
            variant="ghost"
            class="text-default hover:text-error focus-visible:text-error"
            :aria-label="`Delete ${row.original.key}`"
            @click.stop="remove(row.original)"
          />
        </div>
      </template>
    </DataTable>

    <CreateDialog
      v-model:open="creating"
      title="New field"
      :description="`A new field on ${collection.label ?? name}.`"
      key-description="How the field is referenced in queries and content files."
      :loading="saving"
      :validate="invalid"
      @create="create"
    >
      <UFormField label="Type">
        <USelect v-model="type" :items="FIELD_TYPE_ITEMS" value-key="value" class="w-full" />
      </UFormField>
    </CreateDialog>

    <CollectionDialog
      v-model:open="editing"
      :name="name"
      :label="collection.label ?? ''"
      :description="collection.description ?? ''"
      :loading="saving"
      :validate="invalidCollection"
      @save="edit"
    />

    <MigrationDialog :review="review" />
  </div>
</template>
