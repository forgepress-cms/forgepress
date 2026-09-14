<script setup lang="ts">
import type { Field } from '../../../../schema/fields'
import { computed, reactive, ref, watch } from 'vue'

import { fieldTypeNames, fieldTypes } from '../../../../schema/fields'
import { migrate } from '../../../../schema/migrate'
import { filled } from '../../../../utils/value'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import DiscardDialog from '../../../components/DiscardDialog.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import ListSelect from '../../../components/fields/ListSelect.vue'
import FormLayout from '../../../components/layout/FormLayout.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import MetaItem from '../../../components/MetaItem.vue'
import { useContent } from '../../../composables/useContent'
import { useDraft } from '../../../composables/useDraft'
import { useLeaveGuard } from '../../../composables/useLeaveGuard'
import { useParam } from '../../../composables/useParam'
import { useRouter } from '../../../composables/useRouter'
import { useSchema } from '../../../composables/useSchema'
import { seedOption } from '../../../utils/schema'

const BASE_KEYS = new Set(['type', 'label', 'description', 'optional', 'translate'])

const { navigate, href } = useRouter()

const { store } = useContent()

const name = useParam('collection')
const field = useParam('field')

const { schema, saving, error, write } = await useSchema()

const collection = schema.value.collections[name]
const current = collection?.fields[field]

if (!collection || !current) {
  throw new Error(`[forgepress] ${name} has no field named ${field}`)
}

const locales = schema.value.locales ?? []
const translatable = locales.length > 0

const rows = await store.list(name)

const form = reactive({
  label: current.label ?? '',
  description: current.description ?? '',
  type: current.type as Field['type'],
  required: !current.optional,
  translate: current.translate ?? false,
})

const options = reactive<Record<string, unknown>>(
  Object.fromEntries(Object.entries(current).filter(([option]) => !BASE_KEYS.has(option))),
)

const definition = computed(() => fieldTypes[form.type])

const typeItems = fieldTypeNames.map(type => ({ label: fieldTypes[type].label, value: type }))

const collectionItems = Object.entries(schema.value.collections).map(([value, entry]) => ({
  label: entry.label ?? value,
  value,
}))

watch(() => form.type, () => {
  for (const [option, spec] of Object.entries(definition.value.options))
    options[option] ??= seedOption(spec)
}, { immediate: true })

function configured(value: unknown): boolean {
  return value !== false && filled(value)
}

function back(): void {
  navigate(`schema/${name}`)
}

const { dirty, leaving, commit, cancel, discard, proceed } = useLeaveGuard(useDraft(() => ({ form, options }), back))

const valid = computed(() => Object.entries(definition.value.options)
  .every(([option, spec]) => !('required' in spec) || configured(options[option])))

function next(): Field {
  const config: Record<string, unknown> = { type: form.type }

  if (form.label)
    config.label = form.label

  if (form.description)
    config.description = form.description

  if (!form.required)
    config.optional = true

  if (form.translate)
    config.translate = true

  for (const option of Object.keys(definition.value.options)) {
    if (configured(options[option]))
      config[option] = options[option]
  }

  return config as unknown as Field
}

const migration = computed(() => migrate(rows, field, current, next(), locales))

const confirming = ref(false)

async function save(): Promise<void> {
  confirming.value = false

  const config = next()
  const { rows: migrated, changed } = migration.value

  const written = await write((draft) => {
    draft.collections[name]!.fields[field] = config
  }, async (writer) => {
    if (changed)
      await writer.writeContent(name, migrated)
  })

  if (!written)
    return

  rows.splice(0, rows.length, ...migrated)

  commit()
  proceed()
}

function submit(): void {
  if (migration.value.lost)
    confirming.value = true
  else
    void save()
}
</script>

<template>
  <div class="grid gap-6">
    <PageHeader
      :title="form.label || field"
      :breadcrumb="[
        { label: 'Schema', to: href('schema') },
        { label: collection.label ?? name, to: href(`schema/${name}`) },
      ]"
    >
      <template #actions>
        <UButton label="Cancel" color="neutral" variant="ghost" @click="cancel()" />

        <UButton
          label="Save"
          icon="i-lucide-save"
          :loading="saving"
          :disabled="!valid || !dirty || !!migration.missing"
          @click="submit()"
        />
      </template>
    </PageHeader>

    <ErrorAlert title="The schema could not be saved" :error="error" />

    <p v-if="migration.missing" class="text-sm text-muted">
      {{ migration.missing }} {{ migration.missing === 1 ? 'entry has' : 'entries have' }} no value for every locale of a
      required field. Fill {{ migration.missing === 1 ? 'it' : 'them' }} in first, or leave the field optional.
    </p>

    <p v-else-if="migration.changed" class="text-sm text-muted">
      Saving rewrites {{ migration.changed }} {{ migration.changed === 1 ? 'entry' : 'entries' }} to match the field.
    </p>

    <DiscardDialog
      v-model:open="leaving"
      :saveable="valid && !migration.missing && !migration.lost"
      :loading="saving"
      @save="save()"
      @confirm="discard()"
    />

    <ConfirmDialog
      v-model:open="confirming"
      title="Content does not fit"
      :description="`${migration.lost} ${migration.lost === 1 ? 'entry loses content' : 'entries lose content'} that the field can no longer hold. This cannot be undone.`"
      label="Save anyway"
      @confirm="save()"
    />

    <FormLayout>
      <UFormField label="Label" description="How the field is titled in the editor." :ui="{ container: 'mt-2' }">
        <UInput v-model="form.label" :placeholder="field" class="w-full" />
      </UFormField>

      <UFormField
        label="Description"
        description="Shown underneath the field while editing content."
        :ui="{ container: 'mt-2' }"
      >
        <UTextarea v-model="form.description" :rows="2" class="w-full" />
      </UFormField>

      <template v-if="Object.keys(definition.options).length">
        <USeparator :label="`${definition.label} options`" />

        <UFormField
          v-for="(option, optionKey) in definition.options"
          :key="optionKey"
          :label="option.label"
          :required="'required' in option"
          :ui="{ container: 'mt-2' }"
        >
          <USwitch v-if="option.type === 'boolean'" v-model="options[optionKey] as boolean" />

          <UInputNumber
            v-else-if="option.type === 'number'"
            v-model="options[optionKey] as number"
            class="w-full"
          />

          <USelect
            v-else-if="option.type === 'collection'"
            v-model="options[optionKey] as string"
            :items="collectionItems"
            value-key="value"
            class="w-full"
          />

          <ListSelect
            v-else-if="option.type === 'collections'"
            v-model="options[optionKey] as string[]"
            :items="collectionItems"
            placeholder="Add a collection"
            multiple
          />

          <UInput v-else v-model="options[optionKey] as string" class="w-full" />
        </UFormField>
      </template>

      <template #sidebar>
        <MetaItem label="Key" :value="field" mono />

        <USeparator />

        <UFormField label="Type">
          <USelect v-model="form.type" :items="typeItems" value-key="value" class="w-full" />
        </UFormField>

        <UFormField label="Required" description="Content cannot be saved while a required field is empty.">
          <USwitch v-model="form.required" />
        </UFormField>

        <UFormField
          label="Translated"
          :description="translatable ? 'Holds a separate value per locale.' : 'Add locales to the schema to translate fields.'"
        >
          <USwitch v-model="form.translate" :disabled="!translatable" />
        </UFormField>
      </template>
    </FormLayout>
  </div>
</template>
