<script setup lang="ts">
import type { SchemaDraft } from '../../../../src/migrate/schema'
import type { Field } from '../../../../src/schema/fields'
import type { ForgePressSchema } from '../../../../src/schema/types'
import { computed, reactive, watch } from 'vue'

import { planMigration } from '../../../../src/migrate/plan'
import { fieldTypes } from '../../../../src/schema/fields'
import { BASE_OPTIONS, RESERVED_FIELDS } from '../../../../src/schema/validate'
import { filled, plain } from '../../../../src/utils/value'
import DiscardDialog from '../../../components/DiscardDialog.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import ListSelect from '../../../components/fields/ListSelect.vue'
import FormLayout from '../../../components/layout/FormLayout.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import MigrationDialog from '../../../components/MigrationDialog.vue'
import MigrationNotice from '../../../components/MigrationNotice.vue'
import { useDraft } from '../../../composables/useDraft'
import { useLeaveGuard } from '../../../composables/useLeaveGuard'
import { useParam } from '../../../composables/useParam'
import { useRouter } from '../../../composables/useRouter'
import { useSchema } from '../../../composables/useSchema'
import { FIELD_TYPE_ITEMS, KEY_PATTERN, seedOption } from '../../../utils/schema'

const BASE_KEYS = new Set(['type', ...Object.keys(BASE_OPTIONS)])

const { navigate, href } = useRouter()

const name = useParam('collection')
const field = useParam('field')

const editor = await useSchema()
const { schema, saving, error, review, change } = editor

const collection = schema.value.collections[name]
const current = collection?.fields[field]

if (!collection || !current) {
  throw new Error(`[forgepress] ${name} has no field named ${field}`)
}

const title = collection.label ?? name
const locales = schema.value.locales ?? []
const translatable = locales.length > 0

const content = await editor.content()

const form = reactive({
  key: field,
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

const keyError = computed(() => {
  const key = form.key.trim()

  if (key === field)
    return ''

  if (!key)
    return 'A key is required'

  if (!KEY_PATTERN.test(key))
    return 'A key has to start with a letter and hold only letters, digits or underscores'

  if (RESERVED_FIELDS.includes(key))
    return `${key} is reserved for entry metadata`

  return Object.hasOwn(collection.fields, key) ? `${key} already exists` : ''
})

const valid = computed(() => !keyError.value && Object.entries(definition.value.options)
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

const key = computed(() => form.key.trim())
const renames = computed(() => key.value === field ? {} : { fields: { [name]: { [field]: key.value } } })

function apply(draft: SchemaDraft): void {
  const target = draft.collections[name]!
  const config = next()

  target.fields = Object.fromEntries(Object.entries(target.fields).map(([item, value]) => item === field ? [key.value, config] : [item, value]))
}

const rewrites = computed(() => {
  if (!valid.value)
    return 0

  const after = plain(schema.value) as SchemaDraft

  apply(after)

  const { changeset } = planMigration({ before: schema.value, after: after as ForgePressSchema, content, renames: renames.value })

  return changeset.write.length
})

async function save(): Promise<void> {
  if (!await change(apply, renames.value))
    return

  commit()
  proceed()
}
</script>

<template>
  <div class="grid gap-8">
    <PageHeader
      :title="form.label || field"
      :breadcrumb="[
        { label: 'Schema', to: href('schema') },
        { label: title, to: href(`schema/${name}`) },
      ]"
    >
      <template #actions>
        <UButton label="Cancel" color="neutral" variant="ghost" @click="cancel()" />

        <UButton
          label="Save"
          icon="i-hugeicons-floppy-disk"
          :loading="saving"
          :disabled="!valid || !dirty"
          @click="save()"
        />
      </template>
    </PageHeader>

    <MigrationNotice :editor="editor" />

    <ErrorAlert title="The schema could not be saved" :error="error" />

    <p v-if="dirty && rewrites" class="text-sm text-muted">
      Saving rewrites {{ rewrites }} {{ rewrites === 1 ? 'entry' : 'entries' }} to match the field.
    </p>

    <DiscardDialog
      v-model:open="leaving"
      :saveable="valid"
      :loading="saving"
      @save="save()"
      @confirm="discard()"
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
          :description="'description' in option ? option.description : ''"
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
        <UFormField
          label="Key"
          :description="key === field ? 'How queries and content files name the field.' : `Content moves along. Code that reads ${field} needs ${key}.`"
          :error="keyError || false"
        >
          <UInput v-model="form.key" class="w-full font-mono" />
        </UFormField>

        <USeparator />

        <UFormField label="Type">
          <USelect v-model="form.type" :items="FIELD_TYPE_ITEMS" value-key="value" class="w-full" />
        </UFormField>

        <UFormField label="Required" description="Content cannot be saved while a required field is empty.">
          <USwitch v-model="form.required" />
        </UFormField>

        <UFormField label="Translated">
          <template #description>
            <template v-if="translatable">
              Holds a separate value per locale.
            </template>

            <template v-else>
              Add a locale on the <ULink :to="href('schema')" class="text-primary underline">
                Schema page
              </ULink> to translate fields.
            </template>
          </template>

          <USwitch v-model="form.translate" :disabled="!translatable" />
        </UFormField>
      </template>
    </FormLayout>

    <MigrationDialog :review="review" />
  </div>
</template>
