<script setup lang="ts">
import type { DynamicBlock } from '../../../fields/dynamic'
import type { Entries } from '../../composables/useEntries'
import type { NestedEntries } from '../../composables/useNestedEntries'
import { ref } from 'vue'
import { useDragOrder } from '../../composables/useDragOrder'
import { useRouter } from '../../composables/useRouter'
import DragHandle from '../DragHandle.vue'
import FieldList from './FieldList.vue'

const props = defineProps<{
  collections: readonly string[]
  entries: Entries
  nested: NestedEntries
  locales: readonly string[]
}>()

const model = defineModel<DynamicBlock[]>({ required: true })

const { navigate } = useRouter()

const order = useDragOrder((key, offset) => move(Number(key), offset))

const picking = ref(false)

function move(from: number, offset: number): void {
  const blocks = [...model.value]
  const to = from + offset

  if (to < 0 || to >= blocks.length)
    return

  blocks.splice(to, 0, ...blocks.splice(from, 1))

  model.value = blocks
}

function add(collection: string): void {
  model.value = [...model.value, { collection, id: props.nested.create(collection) }]
  picking.value = false
}

function link(index: number): void {
  const block = model.value[index]!

  props.nested.discard(block.id)
  reassign(index, '')
}

function remove(index: number): void {
  const block = model.value[index]!

  props.nested.discard(block.id)
  model.value = model.value.filter((_, position) => position !== index)
}

function reassign(index: number, id: string): void {
  model.value = model.value.map((block, position) => position === index ? { ...block, id } : block)
}
</script>

<template>
  <div class="grid gap-3">
    <div v-if="model.length" data-drag class="grid gap-3">
      <div
        v-for="(block, index) in model"
        :key="index"
        class="overflow-hidden rounded-lg border border-default bg-default"
        :class="order.rowClass(index, String(index))"
      >
        <div class="flex items-center gap-2 border-b border-default bg-elevated/50 px-2 py-1.5">
          <DragHandle @pointerdown="order.start(String(index), index, $event)" />

          <span class="flex-1 truncate text-sm font-medium text-highlighted">
            {{ entries.collectionLabel(block.collection) }}
          </span>

          <UButton
            :disabled="!block.id || !!nested.drafts[block.id]"
            icon="i-lucide-arrow-up-right"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="`Open ${entries.label(block.collection, block.id)}`"
            @click="navigate(`content/${block.collection}/${block.id}`)"
          />

          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            :aria-label="`Remove ${entries.collectionLabel(block.collection)}`"
            @click="remove(index)"
          />
        </div>

        <div class="grid gap-4 p-3">
          <template v-if="nested.drafts[block.id]">
            <FieldList
              :fields="nested.drafts[block.id]!.fields"
              :values="nested.drafts[block.id]!.values"
              :entries="entries"
              :nested="nested"
              :locales="locales"
            />

            <div>
              <UButton
                label="Use an existing entry instead"
                icon="i-lucide-link"
                color="neutral"
                variant="link"
                size="xs"
                class="p-0"
                @click="link(index)"
              />
            </div>
          </template>

          <div v-else class="flex items-center gap-2">
            <USelectMenu
              :model-value="block.id"
              :items="entries.options(block.collection)"
              value-key="value"
              placeholder="Pick an entry"
              icon="i-lucide-search"
              class="flex-1"
              @update:model-value="reassign(index, String($event))"
            />

            <UButton
              label="New"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              @click="reassign(index, nested.create(block.collection))"
            />
          </div>
        </div>
      </div>
    </div>

    <UButton
      label="Add a block"
      icon="i-lucide-circle-plus"
      color="neutral"
      variant="outline"
      block
      class="border-dashed"
      :ui="{ leadingIcon: picking ? 'transition-transform rotate-45' : 'transition-transform' }"
      @click="picking = !picking"
    />

    <div v-if="picking" class="grid gap-3 rounded-lg border border-default bg-default p-4 shadow-lg">
      <p class="text-center text-xs font-semibold text-muted">
        Pick a collection
      </p>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          v-for="collection in collections"
          :key="collection"
          type="button"
          class="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-default bg-elevated/50 px-2 hover:bg-elevated"
          @click="add(collection)"
        >
          <span class="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UIcon name="i-lucide-box" class="size-5" />
          </span>

          <span class="w-full truncate text-sm font-medium text-highlighted">
            {{ entries.collectionLabel(collection) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
