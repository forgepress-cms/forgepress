<script setup lang="ts">
import type { EntryRef } from '../../../src/entries/types'
import type { Entries } from '../../composables/useEntries'
import type { NestedEntries } from '../../composables/useNestedEntries'
import { computed, ref, watchEffect } from 'vue'
import { isEntryRef } from '../../../src/entries/references'
import { useDragOrder } from '../../composables/useDragOrder'
import { useRouter } from '../../composables/useRouter'
import { NESTED_DEPTH } from '../../utils/entry'
import { moveItem } from '../../utils/order'
import DragHandle from '../DragHandle.vue'
import FieldList from './FieldList.vue'

const props = defineProps<{
  collections: readonly string[]
  multiple?: boolean | undefined
  entries: Entries
  nested: NestedEntries
  locales: readonly string[]
  trail: readonly EntryRef[]
}>()

const model = defineModel<unknown>({ required: true })

const blocks = computed<EntryRef[]>(() => {
  const value = model.value

  if (props.multiple)
    return Array.isArray(value) ? value as EntryRef[] : []

  return isEntryRef(value) ? [{ collection: value.collection, id: value.id }] : []
})

function replace(next: EntryRef[]): void {
  model.value = props.multiple ? next : next[0] ?? null
}

const { href } = useRouter()

const order = useDragOrder((key, offset) => {
  replace(moveItem(blocks.value, Number(key), offset))
})

const picking = ref(false)
const linking = ref<number>()

const deep = computed(() => props.trail.length > NESTED_DEPTH)

function owner(): EntryRef {
  return props.trail[props.trail.length - 1]!
}

function same(left: EntryRef, right: EntryRef): boolean {
  return left.collection === right.collection && left.id === right.id
}

function repeated(block: EntryRef): boolean {
  return props.trail.some(entry => same(entry, block))
}

function created(block: EntryRef): boolean {
  return props.nested.drafts[block.id]?.linked === false
}

function linked(block: EntryRef): boolean {
  return !created(block) && block.id !== '' && props.entries.row(block.collection, block.id) !== undefined
}

function others(block: EntryRef): number {
  return linked(block) ? props.entries.usedBy(block.collection, block.id).filter(entry => !same(entry, owner())).length : 0
}

function chain(block: EntryRef): string {
  if (!linked(block))
    return 'Link an existing entry instead'

  const count = others(block)
  const label = `Linked to ${props.entries.label(block.collection, block.id)}`

  return count ? `${label}, also used in ${count} other ${count === 1 ? 'entry' : 'entries'}` : label
}

function prompt(block: EntryRef): string {
  const state = block.id ? `${block.id} does not exist anymore.` : 'No entry is linked yet.'

  return `${state} Link one with the chain icon${deep.value ? '' : ' or start with new content'}.`
}

watchEffect(() => {
  if (deep.value)
    return

  for (const block of blocks.value) {
    const row = linked(block) && !repeated(block) ? props.entries.row(block.collection, block.id) : undefined

    if (row && !props.nested.drafts[block.id])
      props.nested.open(block.collection, row)
  }
})

function reassign(index: number, id: string): void {
  replace(blocks.value.map((block, position) => position === index ? { ...block, id } : block))
}

function add(collection: string): void {
  replace([...blocks.value, { collection, id: deep.value ? '' : props.nested.create(collection, owner().id) }])
  picking.value = false
}

function start(index: number): void {
  reassign(index, props.nested.create(blocks.value[index]!.collection, owner().id))
}

function choose(index: number, id: string): void {
  const block = blocks.value[index]!

  if (created(block))
    props.nested.discard(block.id)

  reassign(index, id)
  linking.value = undefined
}

function unlink(index: number): void {
  const block = blocks.value[index]!
  const copy = props.nested.copy(block.id, owner().id)

  props.nested.discard(block.id)
  reassign(index, copy)
  linking.value = undefined
}

function remove(index: number): void {
  const block = blocks.value[index]!

  if (created(block))
    props.nested.discard(block.id)

  replace(blocks.value.filter((_, position) => position !== index))
}

function groups(block: EntryRef, index: number) {
  const items = props.entries.options(block.collection)
    .filter(option => !repeated({ collection: block.collection, id: option.value }))
    .map(option => ({
      label: option.label,
      chip: option.chip,
      active: linked(block) && option.value === block.id,
      onSelect: () => choose(index, option.value),
    }))

  const actions = linked(block) && props.nested.drafts[block.id]
    ? [{ id: 'actions', items: [{ label: 'Unlink and keep a copy', icon: 'i-hugeicons-unlink-01', onSelect: () => unlink(index) }] }]
    : []

  return [{ id: 'entries', items }, ...actions]
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3">
    <div v-if="blocks.length" data-drag class="grid grid-cols-1 gap-3">
      <div
        v-for="(block, index) in blocks"
        :key="index"
        class="overflow-hidden rounded-lg border border-default bg-default"
        :class="order.rowClass(index, String(index))"
      >
        <div class="flex items-center gap-1 border-b border-default bg-elevated/50 px-2 py-1.5">
          <DragHandle v-if="multiple" class="me-1" @pointerdown="order.start(String(index), index, $event)" />

          <span class="flex-1 truncate text-sm font-medium text-highlighted">
            {{ entries.collectionLabel(block.collection) }}
          </span>

          <UPopover :open="linking === index" @update:open="linking = $event ? index : undefined">
            <UButton
              v-bind="others(block) ? { label: String(others(block)) } : {}"
              icon="i-hugeicons-link-01"
              :color="linked(block) ? 'primary' : 'neutral'"
              variant="ghost"
              size="xs"
              :title="chain(block)"
              :aria-label="chain(block)"
            />

            <template #content>
              <UCommandPalette
                :groups="groups(block, index)"
                placeholder="Search entries"
                class="max-h-80 w-80 max-w-[calc(100vw-2rem)]"
              />
            </template>
          </UPopover>

          <UButton
            v-bind="linked(block) ? { to: href(`content/${block.collection}/${block.id}`), target: '_blank' } : {}"
            :disabled="!linked(block)"
            icon="i-hugeicons-arrow-up-right-01"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="`Open ${entries.label(block.collection, block.id)} in a new tab`"
          />

          <UButton
            icon="i-hugeicons-delete-02"
            color="error"
            variant="ghost"
            size="xs"
            class="text-default hover:text-error focus-visible:text-error"
            :aria-label="`Remove ${entries.collectionLabel(block.collection)}`"
            @click="remove(index)"
          />
        </div>

        <div class="grid grid-cols-1 gap-4 p-3">
          <p v-if="linked(block) && repeated(block)" class="text-sm text-muted">
            {{ entries.label(block.collection, block.id) }} is already open above, so it is not shown here again.
          </p>

          <p v-else-if="linked(block) && deep" class="text-sm text-muted">
            {{ entries.label(block.collection, block.id) }} is nested too deeply to edit here, so open it with the arrow above.
          </p>

          <FieldList
            v-else-if="nested.drafts[block.id]"
            :fields="nested.drafts[block.id]!.fields"
            :values="nested.drafts[block.id]!.values"
            :entries="entries"
            :nested="nested"
            :locales="locales"
            :trail="[...trail, block]"
          />

          <div v-else class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-muted">
              {{ prompt(block) }}
            </p>

            <UButton
              v-if="!deep"
              label="New content"
              icon="i-hugeicons-plus-sign"
              color="neutral"
              variant="outline"
              size="xs"
              @click="start(index)"
            />
          </div>
        </div>
      </div>
    </div>

    <UButton
      v-if="multiple || !blocks.length"
      :label="multiple ? 'Add a block' : 'Choose a collection'"
      icon="i-hugeicons-add-circle"
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
          <span class="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <UIcon name="i-hugeicons-package" class="size-5" />
          </span>

          <span class="w-full truncate text-sm font-medium text-highlighted">
            {{ entries.collectionLabel(collection) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
