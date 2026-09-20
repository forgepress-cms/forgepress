<script setup lang="ts">
import type { EntryRef } from '../../../src/entries/types'
import type { Entries } from '../../composables/useEntries'
import type { NestedEntries } from '../../composables/useNestedEntries'
import type { EntryValues } from '../../utils/entry'
import type { ComponentForm, LocalizedField } from '../../utils/schema'
import { computed, ref, watch } from 'vue'
import { COMPONENT_KEY, items } from '../../../src/schema/fields/picked'
import { isRecord, same } from '../../../src/utils/value'
import { useDragOrder } from '../../composables/useDragOrder'
import { fieldLocale, fromItem, itemValues, titleField } from '../../utils/entry'
import { moveItem } from '../../utils/order'
import { chips } from '../../utils/preview'
import DragHandle from '../DragHandle.vue'
import FieldList from './FieldList.vue'

const props = defineProps<{
  forms: ComponentForm[]
  label: string
  multiple: boolean
  tagged: boolean
  entries: Entries
  nested: NestedEntries
  locales: readonly string[]
  trail: readonly EntryRef[]
}>()

const model = defineModel<unknown>({ required: true })

interface Draft {
  id: number
  form: ComponentForm
  fields: LocalizedField[]
  values: EntryValues
}

let counter = 0
let emitted: unknown

function formOf(item: unknown): ComponentForm | undefined {
  if (!props.tagged)
    return props.forms[0]

  const name = isRecord(item) ? item[COMPONENT_KEY] : undefined

  return props.forms.find(form => form.name === name)
}

function draft(form: ComponentForm, item: unknown): Draft {
  return {
    id: ++counter,
    form,
    fields: form.fields.map(field => ({ ...field, locale: fieldLocale(field, props.locales) })),
    values: itemValues(form.fields, item, props.locales),
  }
}

function drafted(value: unknown): Draft[] {
  return items(value, props.multiple).flatMap((item) => {
    const form = formOf(item)

    return form && item !== null && item !== undefined ? [draft(form, item)] : []
  })
}

const drafts = ref<Draft[]>(drafted(model.value))

watch(model, (value) => {
  if (!same(value, emitted))
    drafts.value = drafted(value)
})

watch(drafts, (current) => {
  const next = current.map((item) => {
    const values = fromItem(item.form.fields, item.values)

    return props.tagged ? { [COMPONENT_KEY]: item.form.name, ...values } : values
  })

  emitted = props.multiple ? next : next[0] ?? null
  model.value = emitted
}, { deep: true })

const order = useDragOrder((key, offset) => {
  const index = drafts.value.findIndex(item => String(item.id) === key)

  drafts.value = moveItem(drafts.value, index, offset)
})

const menu = computed(() => props.forms.map(form => ({ label: form.label, icon: 'i-hugeicons-layers-01', onSelect: () => add(form) })))

function heading(item: Draft): string {
  const title = titleField(item.fields)
  const text = title ? chips(item.values[title.key]?.[title.locale])[0] : undefined

  return text || (props.tagged ? item.form.label : props.label)
}

function add(form: ComponentForm): void {
  drafts.value = [...drafts.value, draft(form, {})]
}

function remove(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3">
    <div v-if="drafts.length" data-drag class="grid grid-cols-1 gap-3">
      <div
        v-for="(item, index) in drafts"
        :key="item.id"
        class="overflow-hidden rounded-lg border border-default bg-default"
        :class="order.rowClass(index, String(item.id))"
      >
        <div class="flex items-center gap-1 border-b border-default bg-elevated/50 px-2 py-1.5">
          <DragHandle v-if="multiple" class="me-1" @pointerdown="order.start(String(item.id), index, $event)" />

          <span class="flex-1 truncate ps-1 text-sm font-medium text-highlighted">
            {{ heading(item) }}
          </span>

          <UButton
            icon="i-hugeicons-delete-02"
            color="error"
            variant="ghost"
            size="xs"
            class="text-default hover:text-error focus-visible:text-error"
            :aria-label="`Remove ${heading(item)}`"
            @click="remove(index)"
          />
        </div>

        <div class="grid grid-cols-1 gap-4 p-3">
          <FieldList
            v-if="item.fields.length"
            :fields="item.fields"
            :values="item.values"
            :entries="entries"
            :nested="nested"
            :locales="locales"
            :trail="trail"
          />

          <p v-else class="text-sm text-muted">
            {{ item.form.label }} has no fields yet.
          </p>
        </div>
      </div>
    </div>

    <UDropdownMenu v-if="(multiple || !drafts.length) && forms.length > 1" :items="menu" :content="{ align: 'center' }">
      <UButton
        label="Add an item"
        icon="i-hugeicons-add-circle"
        color="neutral"
        variant="outline"
        block
        class="border-dashed"
      />
    </UDropdownMenu>

    <UButton
      v-else-if="(multiple || !drafts.length) && forms[0]"
      :label="`Add ${multiple ? 'a' : 'the'} ${forms[0].label.toLowerCase()}`"
      icon="i-hugeicons-add-circle"
      color="neutral"
      variant="outline"
      block
      class="border-dashed"
      @click="add(forms[0])"
    />
  </div>
</template>
