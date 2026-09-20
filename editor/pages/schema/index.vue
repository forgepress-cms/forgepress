<script setup lang="ts">
import type { GroupKind } from '../../composables/useSchemaGroup'
import type { Column } from '../../utils/table'

import { computed, ref } from 'vue'
import { isCollectionName } from '../../../src/files/paths'
import { removeCollection, removeComponent, removeLocale, renameLocale, setDefaultLocale } from '../../../src/migrate/schema'
import { defaultLocale } from '../../../src/schema/locales'
import { LOCALE_CODE } from '../../../src/schema/validate'
import CreateDialog from '../../components/CreateDialog.vue'
import DataTable from '../../components/DataTable.vue'
import DragHandle from '../../components/DragHandle.vue'
import ErrorAlert from '../../components/ErrorAlert.vue'
import PageHeader from '../../components/layout/PageHeader.vue'
import LocaleDialog from '../../components/LocaleDialog.vue'
import MigrationDialog from '../../components/MigrationDialog.vue'
import MigrationNotice from '../../components/MigrationNotice.vue'
import { useDragOrder } from '../../composables/useDragOrder'
import { useRouter } from '../../composables/useRouter'
import { useSchema } from '../../composables/useSchema'
import { groupOf, groupPath } from '../../composables/useSchemaGroup'
import { clamp } from '../../utils/cells'
import { localeName } from '../../utils/locale'
import { moveItem, moveKey } from '../../utils/order'
import { actionsColumn, dragColumn } from '../../utils/table'

interface CollectionRow {
  key: string
  name: string
  description: string
  fields: number
}

interface LocaleRow {
  code: string
  name: string
}

const { navigate } = useRouter()

const editor = await useSchema()
const { schema, saving, error, review, change } = editor

function rows(kind: GroupKind): CollectionRow[] {
  return Object.entries(groupOf(schema.value, kind)).map(([key, collection]) => ({
    key,
    name: collection.label ?? key,
    description: collection.description ?? '',
    fields: Object.keys(collection.fields).length,
  }))
}

const collections = computed(() => rows('collections'))
const components = computed(() => rows('components'))

const locales = computed<LocaleRow[]>(() => (schema.value.locales ?? []).map(code => ({ code, name: localeName(code) ?? '' })))
const chosen = computed(() => defaultLocale(schema.value))

const order = useDragOrder(move)
const componentOrder = useDragOrder(moveComponent)
const localeOrder = useDragOrder(moveLocale)

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

const componentColumns: Column<CollectionRow>[] = columns.map(column => 'accessorKey' in column && column.accessorKey === 'name' ? { ...column, header: 'Component' } : column)

const localeColumns: Column<LocaleRow>[] = [
  dragColumn<LocaleRow>(),
  { accessorKey: 'code', header: 'Locale' },
  { accessorKey: 'name', header: 'Language' },
  actionsColumn(),
]

const creating = ref(false)
const composing = ref(false)
const adding = ref(false)
const editing = ref('')

function invalidIn(kind: GroupKind, key: string): string {
  if (!key)
    return 'A key is required'

  if (!isCollectionName(key))
    return 'A key has to start with a lowercase letter and hold only letters and digits'

  if (Object.hasOwn(groupOf(schema.value, kind), key))
    return `${key} already exists`

  return ''
}

function invalidLocale(code: string, current?: string): string {
  if (!code)
    return 'A code is required'

  if (!LOCALE_CODE.test(code))
    return 'A code has to start with a letter and hold only letters, digits, "-" and "_"'

  if (code !== current && schema.value.locales?.includes(code))
    return `${code} is already a locale`

  return ''
}

async function create(label: string, key: string): Promise<void> {
  creating.value = false

  const written = await change((draft) => {
    draft.collections[key] = { label: label || key, fields: {} }
  })

  if (written)
    navigate(groupPath('collections', key))
}

async function compose(label: string, key: string): Promise<void> {
  composing.value = false

  const written = await change((draft) => {
    draft.components = { ...draft.components, [key]: { label: label || key, fields: {} } }
  })

  if (written)
    navigate(groupPath('components', key))
}

function remove(row: CollectionRow): Promise<boolean> {
  return change(draft => removeCollection(draft, row.key))
}

function removePart(row: CollectionRow): Promise<boolean> {
  return change(draft => removeComponent(draft, row.key))
}

function move(key: string, offset: number): Promise<boolean> {
  return change((draft) => {
    draft.collections = moveKey(draft.collections, key, offset)
  })
}

function moveComponent(key: string, offset: number): Promise<boolean> {
  return change((draft) => {
    draft.components = moveKey(draft.components ?? {}, key, offset)
  })
}

async function addLocale(code: string, primary: boolean): Promise<void> {
  adding.value = false

  await change((draft) => {
    draft.locales = [...draft.locales ?? [], code]
    setDefaultLocale(draft, primary ? code : chosen.value ?? code)
  })
}

async function edit(code: string, primary: boolean): Promise<void> {
  const from = editing.value
  const renamed = from !== code
  const promoted = primary && chosen.value !== from

  editing.value = ''

  if (!renamed && !promoted)
    return

  await change((draft) => {
    if (renamed)
      renameLocale(draft, from, code)

    if (promoted)
      setDefaultLocale(draft, code)
  }, renamed ? { locales: { [from]: code } } : {})
}

function removeLanguage(code: string): Promise<boolean> {
  return change(draft => removeLocale(draft, code))
}

function moveLocale(code: string, offset: number): Promise<boolean> {
  return change((draft) => {
    const current = [...draft.locales ?? []]

    draft.locales = moveItem(current, current.indexOf(code), offset)
    setDefaultLocale(draft, chosen.value!)
  })
}
</script>

<template>
  <div class="grid gap-8">
    <PageHeader title="Schema" description="The collections that make up your content, the components they hold, and their fields.">
      <template #actions>
        <UButton label="New collection" icon="i-hugeicons-plus-sign" :loading="saving" @click="creating = true" />
      </template>
    </PageHeader>

    <MigrationNotice :editor="editor" />

    <ErrorAlert title="The schema could not be saved" :error="error" />

    <DataTable
      :data="collections"
      :columns="columns"
      :row-id="row => row.key"
      :row-class="row => order.rowClass(row.index, row.original.key)"
      empty="No collections in the schema"
      @select="row => navigate(groupPath('collections', row.key))"
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
            @click.stop="remove(row.original)"
          />
        </div>
      </template>
    </DataTable>

    <section class="mt-6 grid gap-4">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div class="grid min-w-0 gap-1">
          <h2 class="font-display text-3xl font-bold tracking-[-0.02em] text-highlighted">
            Components
          </h2>

          <p class="text-sm text-muted">
            Groups of fields that live inside an entry, such as the cards of a page. They have no entries of their own.
          </p>
        </div>

        <UButton label="New component" icon="i-hugeicons-plus-sign" color="neutral" variant="outline" :loading="saving" @click="composing = true" />
      </div>

      <DataTable
        :data="components"
        :columns="componentColumns"
        :row-id="row => row.key"
        :row-class="row => componentOrder.rowClass(row.index, row.original.key)"
        empty="No components yet. Add one to nest fields inside entries."
        @select="row => navigate(groupPath('components', row.key))"
      >
        <template #drag-cell="{ row }">
          <DragHandle @pointerdown="componentOrder.start(row.original.key, row.index, $event)" />
        </template>

        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end">
            <UButton
              icon="i-hugeicons-delete-02"
              color="error"
              variant="ghost"
              class="text-default hover:text-error focus-visible:text-error"
              :aria-label="`Delete ${row.original.name}`"
              @click.stop="removePart(row.original)"
            />
          </div>
        </template>
      </DataTable>
    </section>

    <section class="mt-6 grid gap-4">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div class="grid min-w-0 gap-1">
          <h2 class="font-display text-3xl font-bold tracking-[-0.02em] text-highlighted">
            Locales
          </h2>

          <p class="text-sm text-muted">
            The languages translated fields hold a value for. The default one is what the editor shows first.
          </p>
        </div>

        <UButton label="Add locale" icon="i-hugeicons-plus-sign" color="neutral" variant="outline" :loading="saving" @click="adding = true" />
      </div>

      <DataTable
        :data="locales"
        :columns="localeColumns"
        :row-id="row => row.code"
        :row-class="row => localeOrder.rowClass(row.index, row.original.code)"
        empty="No locales yet. Add one to translate fields."
      >
        <template #drag-cell="{ row }">
          <DragHandle @pointerdown="localeOrder.start(row.original.code, row.index, $event)" />
        </template>

        <template #code-cell="{ row }">
          <span class="flex items-center gap-2">
            <span class="font-mono text-highlighted">{{ row.original.code }}</span>

            <UBadge v-if="row.original.code === chosen" label="Default" color="neutral" variant="soft" size="sm" />
          </span>
        </template>

        <template #actions-cell="{ row }">
          <div class="flex items-center justify-end">
            <UButton
              icon="i-hugeicons-pencil-edit-02"
              color="neutral"
              variant="ghost"
              :aria-label="`Edit ${row.original.code}`"
              @click.stop="editing = row.original.code"
            />

            <UButton
              icon="i-hugeicons-delete-02"
              color="error"
              variant="ghost"
              class="text-default hover:text-error focus-visible:text-error"
              :aria-label="`Delete ${row.original.code}`"
              @click.stop="removeLanguage(row.original.code)"
            />
          </div>
        </template>
      </DataTable>
    </section>

    <CreateDialog
      v-model:open="creating"
      title="New collection"
      description="Collections describe one kind of content entry."
      key-description="How the collection is referenced in queries and content files."
      :loading="saving"
      :validate="key => invalidIn('collections', key)"
      @create="create"
    />

    <CreateDialog
      v-model:open="composing"
      title="New component"
      description="Components group fields that entries hold inline, one item or a list of them."
      key-description="How fields name the component in the schema."
      :loading="saving"
      :validate="key => invalidIn('components', key)"
      @create="compose"
    />

    <LocaleDialog
      v-model:open="adding"
      title="Add locale"
      description="Translated fields get a value for every locale."
      label="Add"
      :primary="!locales.length"
      :loading="saving"
      :validate="code => invalidLocale(code)"
      @save="addLocale"
    />

    <LocaleDialog
      :open="!!editing"
      title="Edit locale"
      description="Edit the locale code and default status."
      label="Save"
      :code="editing"
      :primary="chosen === editing"
      :loading="saving"
      :validate="code => invalidLocale(code, editing)"
      @update:open="value => !value && (editing = '')"
      @save="edit"
    />

    <MigrationDialog :review="review" />
  </div>
</template>
