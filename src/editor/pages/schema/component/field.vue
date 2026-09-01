<script setup lang="ts">
import type { ElementType } from '../../../../elements'
import type { ElementOption } from '../../../../types/core/element'

import { computed, reactive, watch } from 'vue'
import { elements, elementTypes } from '../../../../elements'
import DiscardDialog from '../../../components/DiscardDialog.vue'
import ErrorAlert from '../../../components/ErrorAlert.vue'
import ListSelect from '../../../components/fields/ListSelect.vue'
import FormLayout from '../../../components/layout/FormLayout.vue'
import PageHeader from '../../../components/layout/PageHeader.vue'
import MetaItem from '../../../components/MetaItem.vue'
import { useDraft } from '../../../composables/useDraft'
import { useLeaveGuard } from '../../../composables/useLeaveGuard'
import { useParam } from '../../../composables/useParam'
import { useRouter } from '../../../composables/useRouter'
import { useSchema } from '../../../composables/useSchema'

const BASE_KEYS = new Set(['type', 'label', 'description', 'optional', 'translate'])

const { navigate, href } = useRouter()

const name = useParam('component')
const field = useParam('field')

const { schema, saving, error, write } = await useSchema()

const component = schema.value.components[name]
const element = component?.elements[field]

if (!component || !element) {
  throw new Error(`[webenv] ${name} has no field named ${field}`)
}

const translatable = (schema.value.locales?.length ?? 0) > 0

const form = reactive({
  label: element.label ?? '',
  description: element.description ?? '',
  type: element.type as ElementType['type'],
  required: !element.optional,
  translate: element.translate ?? false,
})

const options = reactive<Record<string, unknown>>(
  Object.fromEntries(Object.entries(element).filter(([option]) => !BASE_KEYS.has(option))),
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

const { dirty, leaving, commit, cancel, discard } = useLeaveGuard(useDraft(() => ({ form, options }), back))

const valid = computed(() => Object.entries(definition.value.options)
  .every(([option, spec]) => !('required' in spec) || filled(options[option])))

async function submit(): Promise<void> {
  const next: Record<string, unknown> = { type: form.type }

  if (form.label)
    next.label = form.label

  if (form.description)
    next.description = form.description

  if (!form.required)
    next.optional = true

  if (form.translate)
    next.translate = true

  for (const option of Object.keys(definition.value.options)) {
    if (filled(options[option]))
      next[option] = options[option]
  }

  const written = await write((draft) => {
    draft.components[name]!.elements[field] = next as unknown as ElementType
  })

  if (written) {
    commit()
    back()
  }
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
          :disabled="!valid || !dirty"
          @click="submit()"
        />
      </template>
    </PageHeader>

    <ErrorAlert title="The schema could not be saved" :error="error" />

    <DiscardDialog v-model:open="leaving" @confirm="discard()" />

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
