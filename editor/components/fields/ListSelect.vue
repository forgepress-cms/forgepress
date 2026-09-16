<script setup lang="ts">
import type { StatusColor } from '../../utils/entry'
import { computed, ref, watch } from 'vue'
import { useDragOrder } from '../../composables/useDragOrder'
import { moveItem } from '../../utils/order'
import DragHandle from '../DragHandle.vue'

interface Option {
  label: string
  value: string
  chip?: { color: StatusColor }
}

const props = withDefaults(defineProps<{
  items: Option[]
  multiple?: boolean | undefined
  placeholder?: string | undefined
  link?: ((value: string) => string) | undefined
}>(), { placeholder: 'Select' })

const model = defineModel<string[]>({ required: true })

const picked = ref('')

const available = computed(() => props.items.filter(item => !model.value.includes(item.value)))

const selected = computed(() => model.value.map(value =>
  props.items.find(item => item.value === value) ?? { label: value, value },
))

const picking = computed(() => available.value.length > 0 && (props.multiple || !model.value.length))

const sortable = computed(() => props.multiple && model.value.length > 1)

const order = useDragOrder((value, offset) => {
  model.value = moveItem(model.value, model.value.indexOf(value), offset)
})

function remove(value: string): void {
  model.value = model.value.filter(item => item !== value)
}

watch(picked, (value) => {
  if (!value)
    return

  model.value = props.multiple ? [...model.value, value] : [value]
  picked.value = ''
})
</script>

<template>
  <div class="grid grid-cols-1 gap-2">
    <USelectMenu
      v-if="picking"
      v-model="picked"
      :items="available"
      value-key="value"
      :placeholder="placeholder"
      icon="i-hugeicons-search-01"
      class="w-full"
    />

    <div v-if="selected.length" data-drag class="grid grid-cols-1 gap-1.5">
      <div
        v-for="(item, index) in selected"
        :key="item.value"
        class="flex items-center gap-2 rounded-lg border border-default bg-elevated/50 px-2 py-1.5"
        :class="order.rowClass(index, item.value)"
      >
        <DragHandle v-if="sortable" @pointerdown="order.start(item.value, index, $event)" />

        <UChip v-if="item.chip" class="pt-2 pe-1" :color="item.chip.color" standalone />

        <span class="flex-1 truncate text-sm text-highlighted">{{ item.label }}</span>

        <UButton
          v-if="link"
          :to="link(item.value)"
          target="_blank"
          icon="i-hugeicons-arrow-up-right-01"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="`Open ${item.label} in a new tab`"
        />

        <UButton
          icon="i-hugeicons-cancel-01"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="`Remove ${item.label}`"
          @click="remove(item.value)"
        />
      </div>
    </div>
  </div>
</template>
