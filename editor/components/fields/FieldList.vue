<script setup lang="ts">
import type { EntryRef } from '../../../src/entries/types'
import type { Entries } from '../../composables/useEntries'
import type { NestedEntries } from '../../composables/useNestedEntries'
import type { EntryValues } from '../../utils/entry'
import type { LocalizedField } from '../../utils/schema'
import { localeItems } from '../../utils/entry'
import DynamicInput from './DynamicInput.vue'
import MediaInput from './MediaInput.vue'
import RelationInput from './RelationInput.vue'
import RichTextInput from './RichTextInput.vue'

const props = defineProps<{
  fields: LocalizedField[]
  values: EntryValues
  entries: Entries
  nested: NestedEntries
  locales: readonly string[]
  trail: readonly EntryRef[]
}>()

const localeTabs = localeItems(props.locales)
</script>

<template>
  <UFormField
    v-for="field in fields"
    :key="field.key"
    :label="field.label"
    :description="field.description"
    :required="!field.optional && field.type !== 'boolean'"
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

    <USwitch
      v-else-if="field.type === 'boolean'"
      v-model="values[field.key]![field.locale]"
    />

    <MediaInput
      v-else-if="field.config.type === 'image' || field.config.type === 'video'"
      v-model="values[field.key]![field.locale]"
      :kind="field.config.type"
      :multiple="field.config.multiple"
    />

    <RelationInput
      v-else-if="field.config.type === 'relation'"
      v-model="values[field.key]![field.locale]"
      :collection="field.config.collection"
      :multiple="field.config.multiple"
      :entries="entries"
    />

    <DynamicInput
      v-else-if="field.config.type === 'dynamic'"
      v-model="values[field.key]![field.locale]"
      :collections="field.config.collections"
      :entries="entries"
      :nested="nested"
      :locales="locales"
      :trail="trail"
    />

    <UInput
      v-else
      v-model="values[field.key]![field.locale]"
      class="w-full"
    />
  </UFormField>
</template>
