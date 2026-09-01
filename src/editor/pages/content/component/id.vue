<script setup lang="ts">
import { computed, reactive } from 'vue'
import { source } from '../../../../content/source'
import DiscardDialog from '../../../components/DiscardDialog.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import FieldList from '../../../components/fields/FieldList.vue'
import FormLayout from '../../../components/layout/FormLayout.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import MetaItem from '../../../components/MetaItem.vue'
import { useComponent } from '../../../composables/useComponent'
import { useEntries } from '../../../composables/useEntries'
import { useEntryDraft } from '../../../composables/useEntryDraft'
import { useNestedEntries } from '../../../composables/useNestedEntries'
import { useParam } from '../../../composables/useParam'
import { useRouter } from '../../../composables/useRouter'
import { useSave } from '../../../composables/useSave'
import { condense, fieldLocale, missingFields, newEntry, statusColor, STATUSES, titleField } from '../../../utils/entry'
import { writer } from '../../../writer'

const { route, navigate, href } = useRouter()

const name = useParam('component')
const id = route.value.params.id

const { component, locales, fields: elements } = await useComponent(name)

function back(): void {
  navigate(`content/${name}`)
}

const rows = await source.list(name)
const index = id ? rows.findIndex(row => row.id === id) : -1

if (id && index < 0) {
  throw new Error(`[webenv] ${name} has no entry with the id ${id}`)
}

const creating = index < 0
const row = creating ? newEntry(name) : rows[index]!

const fields = reactive(elements.map(field => ({ ...field, locale: fieldLocale(field, locales) })))

const entries = await useEntries()
const nested = await useNestedEntries()

const { values, status, draft, dirty, leaving, commit, cancel, discard } = useEntryDraft(row, fields, locales, back)

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
  const list = creating ? [...rows, next] : rows.map((entry, position) => position === index ? next : entry)

  const written = await save(async () => {
    for (const [component, created] of Object.entries(nested.rows())) {
      const existing = await source.list(component)
      const updated = [...existing, ...created]

      await writer.writeContent(component, updated)
      existing.splice(0, existing.length, ...updated)
    }

    await writer.writeContent(name, list)
  })

  if (!written)
    return

  rows.splice(0, rows.length, ...list)
  nested.clear()
  commit()

  back()
}
</script>

<template>
  <div class="grid gap-6">
    <PageHeader
      :title="title"
      :breadcrumb="[
        { label: 'Content', to: href('content') },
        { label: component.label ?? name, to: href(`content/${name}`) },
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
      @confirm="discard()"
    />

    <FormLayout>
      <FieldList
        :fields="fields"
        :values="values"
        :entries="entries"
        :nested="nested"
        :locales="locales"
      />

      <template #sidebar>
        <UFormField label="Status">
          <USelect v-model="status" :items="STATUSES" value-key="value" class="w-full">
            <template #leading>
              <UChip :color="statusColor(status)" standalone />
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
