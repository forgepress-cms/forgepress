<script setup lang="ts">
import type { EntryRef } from '../../../src/entries/types'
import type { Entries } from '../../composables/useEntries'
import type { NestedEntries } from '../../composables/useNestedEntries'
import type { EntryValues } from '../../utils/entry'
import type { LocalizedField } from '../../utils/schema'
import { localeItems, picked } from '../../utils/entry'
import BlockInput from './BlockInput.vue'
import ComponentInput from './ComponentInput.vue'
import EntrySelect from './EntrySelect.vue'
import ListSelect from './ListSelect.vue'
import MediaInput from './MediaInput.vue'
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

    <ComponentInput
      v-else-if="field.config.type === 'component' && field.components"
      :key="field.locale"
      v-model="values[field.key]![field.locale]"
      :forms="field.components"
      :label="field.label"
      :multiple="field.config.multiple ?? false"
      :tagged="field.config.components.length !== 1"
      :entries="entries"
      :nested="nested"
      :locales="locales"
      :trail="trail"
    />

    <ListSelect
      v-else-if="field.config.type === 'list'"
      :model-value="picked(values[field.key]![field.locale])"
      :items="field.config.values.map(value => ({ label: value, value }))"
      :multiple="field.config.multiple"
      placeholder="Pick a value"
      @update:model-value="values[field.key]![field.locale] = field.config.type === 'list' && field.config.multiple ? $event : $event[0] ?? ''"
    />

    <MediaInput
      v-else-if="field.config.type === 'image' || field.config.type === 'video'"
      v-model="values[field.key]![field.locale]"
      :kind="field.config.type"
      :multiple="field.config.multiple"
    />

    <EntrySelect
      v-else-if="field.config.type === 'collection' && field.config.collections.length === 1"
      v-model="values[field.key]![field.locale]"
      :collection="field.config.collections[0]!"
      :multiple="field.config.multiple"
      :entries="entries"
    />

    <BlockInput
      v-else-if="field.config.type === 'collection'"
      v-model="values[field.key]![field.locale]"
      :collections="field.config.collections"
      :multiple="field.config.multiple"
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
