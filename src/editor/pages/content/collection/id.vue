<script setup lang="ts">
import type { EntryRow } from '../../../../entries/references'
import type { EntryStatus } from '../../../../types/entry'
import { computed, reactive, shallowRef } from 'vue'
import { entryKey, unpublishedReferences } from '../../../../entries/references'
import DiscardDialog from '../../../components/DiscardDialog.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import FieldList from '../../../components/fields/FieldList.vue'
import FormLayout from '../../../components/layout/FormLayout.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import MetaItem from '../../../components/MetaItem.vue'
import PublishLinkedDialog from '../../../components/PublishLinkedDialog.vue'
import { useCollection } from '../../../composables/useCollection'
import { useContent } from '../../../composables/useContent'
import { useEntries } from '../../../composables/useEntries'
import { useEntryDraft } from '../../../composables/useEntryDraft'
import { useNestedEntries } from '../../../composables/useNestedEntries'
import { useParam } from '../../../composables/useParam'
import { useRouter } from '../../../composables/useRouter'
import { useSave } from '../../../composables/useSave'
import { condense, missingFields, newEntry, statusColor, STATUSES, titleField, toLocalizedFields, withPublished } from '../../../utils/entry'

const { route, navigate, href } = useRouter()

const { store } = useContent()

const name = useParam('collection')
const id = route.value.params.id

const { schema, collection, locales } = await useCollection(name)

function back(): void {
  navigate(`content/${name}`)
}

const rows = await store.list(name)
const index = id ? rows.findIndex(row => row.id === id) : -1

if (id && index < 0) {
  throw new Error(`[forgepress] ${name} has no entry with the id ${id}`)
}

const creating = index < 0
const row = creating ? newEntry(name) : rows[index]!

const fields = reactive(toLocalizedFields(collection, locales))

const entries = await useEntries()
const nested = await useNestedEntries()

const { values, status, draft, dirty, leaving, commit, cancel, discard, proceed } = useEntryDraft(row, fields, locales, back, next => nested.rows(next.status))

const original = JSON.stringify(draft())

const title = computed(() => {
  const first = titleField(fields)
  const value = first && values[first.key]![first.locale]
  const label = typeof value === 'string' ? condense(value) : ''

  return label || (creating ? 'New entry' : String(row.id))
})

const missing = computed(() => [
  ...missingFields(fields, values).map(field => field.label),
  ...nested.missing(),
])

const { saving, error, save } = useSave()

const linked = shallowRef<EntryRow[]>([])

const offered = computed(() => linked.value.map(entry => ({
  key: entryKey(entry.collection, entry.row.id),
  collection: entries.collectionLabel(entry.collection),
  label: entries.label(entry.collection, entry.row.id),
})))

async function submit(linkedStatus?: EntryStatus): Promise<void> {
  const updatedAt = new Date().toISOString()
  const next = { ...draft(), updatedAt }
  const changed = creating || JSON.stringify(draft()) !== original

  const saved = [
    ...Object.entries(nested.rows(next.status)).flatMap(([collection, related]) => related.map(entry => ({ collection, row: { ...entry, updatedAt } }))),
    ...changed ? [{ collection: name, row: next }] : [],
  ]

  const unpublished = unpublishedReferences(schema, saved, entries.row)

  if (unpublished.length > 0 && !linkedStatus) {
    linked.value = unpublished
    return
  }

  linked.value = []

  const writes = linkedStatus === 'published' ? withPublished(saved, unpublished, updatedAt) : saved

  const written = await save(async () => {
    for (const entry of writes)
      await store.writeEntry(entry.collection, entry.row)
  })

  if (!written)
    return

  const own = writes.find(entry => entry.collection === name && entry.row.id === row.id)?.row

  if (own && creating)
    rows.push(own)
  else if (own)
    rows[index] = own

  nested.clear()
  commit()

  proceed()
}
</script>

<template>
  <div class="grid gap-6">
    <PageHeader
      :title="title"
      :breadcrumb="[
        { label: 'Content', to: href('content') },
        { label: collection.label ?? name, to: href(`content/${name}`) },
      ]"
    >
      <template #actions>
        <UButton label="Cancel" color="neutral" variant="ghost" @click="cancel()" />

        <UButton
          label="Save"
          icon="i-lucide-save"
          :loading="saving"
          :disabled="!!missing.length || !(dirty || creating)"
          @click="submit()"
        />
      </template>
    </PageHeader>

    <ErrorAlert title="The entry could not be saved" :error="error" />

    <p v-if="missing.length" class="text-sm text-muted">
      {{ missing.join(', ') }} {{ missing.length === 1 ? 'is required' : 'are required' }} before this entry can be saved.
    </p>

    <DiscardDialog
      v-model:open="leaving"
      :description="creating ? 'This entry has not been saved yet and is lost if you leave now.' : undefined"
      :saveable="!missing.length"
      :loading="saving"
      @save="submit()"
      @confirm="discard()"
    />

    <PublishLinkedDialog
      :open="linked.length > 0"
      :entries="offered"
      @update:open="linked = []"
      @publish="submit('published')"
      @keep="submit('unpublished')"
    />

    <FormLayout>
      <FieldList
        :fields="fields"
        :values="values"
        :entries="entries"
        :nested="nested"
        :locales="locales"
        :trail="[{ collection: name, id: row.id }]"
      />

      <template #sidebar>
        <UFormField label="Status">
          <USelect v-model="status" :items="STATUSES" value-key="value" class="w-full">
            <template #leading>
              <UChip :color="statusColor(status)" class="pt-2" standalone />
            </template>
          </USelect>
        </UFormField>

        <USeparator />

        <MetaItem label="Id" :value="row.id" mono />

        <MetaItem label="Created" :value="new Date(row.createdAt).toLocaleString()" />

        <MetaItem label="Updated" :value="new Date(row.updatedAt).toLocaleString()" />
      </template>
    </FormLayout>
  </div>
</template>
