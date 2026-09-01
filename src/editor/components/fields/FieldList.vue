<script setup lang="ts">
import type { Entries } from '../../composables/useEntries'
import type { NestedEntries, NestedField } from '../../composables/useNestedEntries'
import type { EntryValues } from '../../utils/entry'
import { localeItems } from '../../utils/entry'
import DynamicInput from './DynamicInput.vue'
import MediaInput from './MediaInput.vue'
import RelationInput from './RelationInput.vue'
import RichTextInput from './RichTextInput.vue'

const props = defineProps<{
  fields: NestedField[]
  values: EntryValues
  entries: Entries
  nested: NestedEntries
  locales: readonly string[]
}>()

const localeTabs = localeItems(props.locales)
</script>

<template>
  <UFormField
    v-for="field in fields"
    :key="field.key"
    :label="field.label"
    :description="field.description"
    :required="!field.optional"
    :ui="{ container: 'mt-2' }"
  >
    <template #hint>
      <UTabs
        v-if="field.translated"
        v-model="field.locale"
        :items="localeTabs"
        :content="false"
        size="xs"
        variant="pill"
        :ui="{ list: 'p-0.5' }"
      />
    </template>

    <RichTextInput
      v-if="field.type === 'richtext'"
      v-model="values[field.key]![field.locale]"
    />

    <UInputNumber
      v-else-if="field.type === 'number'"
      v-model="values[field.key]![field.locale]"
      class="w-full"
    />

    <MediaInput
      v-else-if="field.element.type === 'image' || field.element.type === 'video'"
      v-model="values[field.key]![field.locale]"
      :kind="field.element.type"
      :multiple="field.element.multiple"
    />

    <RelationInput
      v-else-if="field.element.type === 'relation'"
      v-model="values[field.key]![field.locale]"
      :component="field.element.component"
      :multiple="field.element.multiple"
      :entries="entries"
    />

    <DynamicInput
      v-else-if="field.element.type === 'dynamic'"
      v-model="values[field.key]![field.locale]"
      :components="field.element.components"
      :entries="entries"
      :nested="nested"
      :locales="locales"
    />

    <UInput
      v-else
      v-model="values[field.key]![field.locale]"
      class="w-full"
    />
  </UFormField>
</template>
