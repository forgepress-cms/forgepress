<script setup lang="ts">
import type { ElementType } from '../../../../elements'
import type { ElementOption } from '../../../../types/core/element'
import { computed, reactive, ref, watch } from 'vue'

import { migrate } from '../../../../content/migrate'
import { elements, elementTypes } from '../../../../elements'
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

const BASE_KEYS = new Set(['type', 'label', 'description', 'optional', 'translate'])

const { navigate, href } = useRouter()

const { store } = useContent()

const name = useParam('component')
const field = useParam('field')

const { schema, saving, error, write } = await useSchema()

const component = schema.value.components[name]
const current = component?.elements[field]

if (!component || !current) {
  throw new Error(`[webenv] ${name} has no field named ${field}`)
}

const locales = schema.value.locales ?? []
const translatable = locales.length > 0

const rows = await store.list(name)

const form = reactive({
  label: current.label ?? '',
  description: current.description ?? '',
  type: current.type as ElementType['type'],
  required: !current.optional,
  translate: current.translate ?? false,
})

const options = reactive<Record<string, unknown>>(
  Object.fromEntries(Object.entries(current).filter(([option]) => !BASE_KEYS.has(option))),
)

const definition = computed(() => elements[form.type])

const typeItems = elementTypes.map(type => ({ label: elements[type].label, value: type }))

const componentItems = Object.entries(schema.value.components).map(([value, entry]) => ({
  label: entry.label ?? value,
  value,
}))

function seed(option: ElementOption): unknown {
  return option.type === 'boolean' ? false : option.type === 'components' ? [] : option.type === 'number' ? null : ''
}

watch(() => form.type, () => {
  for (const [option, spec] of Object.entries(definition.value.options)) {
    options[option] ??= seed(spec)
  }
}, { immediate: true })

function filled(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false)
    return false

  return !(Array.isArray(value) && value.length === 0)
}

function back(): void {
  navigate(`schema/${name}`)
}

const { dirty, leaving, commit, cancel, discard, proceed } = useLeaveGuard(useDraft(() => ({ form, options }), back))

const valid = computed(() => Object.entries(definition.value.options)
  .every(([option, spec]) => !('required' in spec) || filled(options[option])))

function next(): ElementType {
  const element: Record<string, unknown> = { type: form.type }

  if (form.label)
    element.label = form.label

  if (form.description)
    element.description = form.description

  if (!form.required)
    element.optional = true

  if (form.translate)
    element.translate = true

  for (const option of Object.keys(definition.value.options)) {
    if (filled(options[option]))
      element[option] = options[option]
  }

  return element as unknown as ElementType
}

const migration = computed(() => migrate(rows, field, current, next(), locales))

const confirming = ref(false)

async function save(): Promise<void> {
  confirming.value = false

  const element = next()
  const { rows: migrated, changed } = migration.value

  const written = await write(async (draft) => {
    draft.components[name]!.elements[field] = element

    if (changed)
      await store.writeContent(name, migrated)
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
        { label: component.label ?? name, to: href(`schema/${name}`) },
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
            v-else-if="option.type === 'component'"
            v-model="options[optionKey] as string"
            :items="componentItems"
            value-key="value"
            class="w-full"
          />

          <ListSelect
            v-else-if="option.type === 'components'"
            v-model="options[optionKey] as string[]"
            :items="componentItems"
            placeholder="Add a component"
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
