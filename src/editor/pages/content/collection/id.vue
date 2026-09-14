<script setup lang="ts">
import { computed, reactive } from 'vue'
import DiscardDialog from '../../../components/DiscardDialog.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import FieldList from '../../../components/fields/FieldList.vue'
import FormLayout from '../../../components/layout/FormLayout.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import MetaItem from '../../../components/MetaItem.vue'
import { useCollection } from '../../../composables/useCollection'
import { useContent } from '../../../composables/useContent'
import { useEntries } from '../../../composables/useEntries'
import { useEntryDraft } from '../../../composables/useEntryDraft'
import { useNestedEntries } from '../../../composables/useNestedEntries'
import { useParam } from '../../../composables/useParam'
import { useRouter } from '../../../composables/useRouter'
import { useSave } from '../../../composables/useSave'
import { condense, missingFields, newEntry, statusColor, STATUSES, titleField, toLocalizedFields } from '../../../utils/entry'

const { route, navigate, href } = useRouter()

const { store } = useContent()

const name = useParam('collection')
const id = route.value.params.id

const { collection, locales } = await useCollection(name)

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

async function submit(): Promise<void> {
  const next = { ...draft(), updatedAt: new Date().toISOString() }
  const changed = creating || JSON.stringify(draft()) !== original

  const written = await save(async () => {
    for (const [collection, related] of Object.entries(nested.rows(next.status))) {
      for (const entry of related)
        await store.writeEntry(collection, { ...entry, updatedAt: next.updatedAt })
    }

    if (changed)
      await store.writeEntry(name, next)
  })

  if (!written)
    return

  if (changed && creating)
    rows.push(next)
  else if (changed)
    rows[index] = next

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
