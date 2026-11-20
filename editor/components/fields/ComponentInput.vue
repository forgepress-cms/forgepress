<script setup lang="ts">
import type { EntryRef } from '../../../src/entries'
import type { Entries, NestedEntries } from '../../composables'
import type { ComponentForm, EntryValues, LocalizedField } from '../../utils'
import { computed, reactive, ref, watch } from 'vue'
import { COMPONENT_KEY, items } from '../../../src/schema'
import { isRecord, same } from '../../../src/utils'
import { useDragOrder } from '../../composables'
import { chips, fieldLocale, fromItem, itemValues, missingFields, moveItem, titleField } from '../../utils'
import DragHandle from '../common/DragHandle.vue'
import FieldList from './FieldList.vue'

const props = defineProps<{
  forms: ComponentForm[]
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
const opened = reactive(new Set<number>())

watch(model, (value) => {
  if (same(value, emitted))
    return

  opened.clear()
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

  return text || item.form.label
}

function incomplete(item: Draft): boolean {
  return missingFields(item.form.fields, item.values, props.locales).length > 0
}

function toggle(id: number): void {
  if (!opened.delete(id))
    opened.add(id)
}

function add(form: ComponentForm): void {
  const created = draft(form, {})

  drafts.value = [...drafts.value, created]
  opened.add(created.id)
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
        <div class="flex items-center gap-1 bg-elevated/50 px-2 py-1.5" :class="opened.has(item.id) && 'border-b border-default'">
          <DragHandle v-if="multiple" class="me-1" @pointerdown="order.start(String(item.id), index, $event)" />

          <button
            type="button"
            class="flex min-w-0 grow cursor-pointer items-center gap-1.5 rounded-sm ps-1 text-left text-sm font-medium text-highlighted"
            :aria-expanded="opened.has(item.id)"
            @click="toggle(item.id)"
          >
            <UIcon :name="opened.has(item.id) ? 'i-hugeicons-arrow-down-01' : 'i-hugeicons-arrow-right-01'" class="size-4 shrink-0 text-muted" />

            <span class="flex-1 truncate">{{ heading(item) }}</span>

            <span v-if="tagged && heading(item) !== item.form.label" class="shrink-0 text-xs font-normal text-muted">{{ item.form.label }}</span>

            <UBadge v-if="!opened.has(item.id) && incomplete(item)" icon="i-hugeicons-alert-02" label="Incomplete" color="warning" variant="soft" size="sm" class="shrink-0" />
          </button>

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

        <div v-if="opened.has(item.id)" class="grid grid-cols-1 gap-4 p-3">
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
