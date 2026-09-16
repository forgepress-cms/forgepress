<script setup lang="ts">
import type { MediaKind } from '../../../src/media'
import type { MediaAsset, MediaContent } from '../../../src/media/types'
import { computed, ref } from 'vue'
import { useDragOrder } from '../../composables/useDragOrder'
import { useMedia } from '../../composables/useMedia'
import { fileName, measure, toList, toMedia } from '../../utils/media'
import { moveItem } from '../../utils/order'
import DragHandle from '../DragHandle.vue'
import MediaLibrary from '../media/MediaLibrary.vue'
import MediaPreview from '../media/MediaPreview.vue'
import MediaUpload from '../media/MediaUpload.vue'

const props = defineProps<{
  kind: MediaKind
  multiple?: boolean | undefined
}>()

const model = defineModel<unknown>({ required: true })

const { resolve } = useMedia()

const picking = ref(false)
const linking = ref(false)
const url = ref('')

const items = computed(() => toList(model.value))

const room = computed(() => props.multiple || !items.value.length)

const sortable = computed(() => props.multiple && items.value.length > 1)

const order = useDragOrder((key, offset) => write(moveItem(items.value, Number(key), offset)))

function write(next: MediaContent[]): void {
  model.value = props.multiple ? next : next[0] ?? null
}

function add(values: MediaContent[]): void {
  write(props.multiple ? [...items.value, ...values] : values.slice(0, 1))
}

function remove(index: number): void {
  write(items.value.filter((_, position) => position !== index))
}

function setAlt(index: number, alt: string): void {
  write(items.value.map((item, position) => position === index ? { ...item, alt } : item))
}

async function insert(assets: MediaAsset[]): Promise<void> {
  add(await Promise.all(assets.map(asset => toMedia(asset, props.kind))))
}

async function link(): Promise<void> {
  const value = url.value.trim()

  if (!value)
    return

  add([{ url: value, ...await measure(value, props.kind) }])

  url.value = ''
  linking.value = false
}
</script>

<template>
  <div class="grid grid-cols-1 gap-2">
    <div v-if="items.length" data-drag class="grid grid-cols-1 gap-2">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="flex gap-3 rounded-lg border border-default bg-default p-2"
        :class="order.rowClass(index, String(index))"
      >
        <DragHandle v-if="sortable" class="self-center" @pointerdown="order.start(String(index), index, $event)" />

        <div class="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-elevated sm:h-16 sm:w-24">
          <MediaPreview :url="resolve(item.url)" :kind="kind" :alt="item.alt" />
        </div>

        <div class="grid min-w-0 flex-1 grid-cols-1 content-start gap-1.5">
          <div class="flex items-center gap-2">
            <div class="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-2">
              <span class="truncate text-sm font-medium text-highlighted">{{ fileName(item.url) }}</span>

              <span v-if="item.width && item.height" class="shrink-0 text-xs text-muted">
                {{ item.width }} × {{ item.height }}
              </span>
            </div>

            <div class="flex shrink-0 items-center">
              <UButton
                :to="item.url"
                target="_blank"
                icon="i-hugeicons-link-square-02"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Open in a new tab"
              />

              <UButton
                icon="i-hugeicons-cancel-01"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Remove"
                @click="remove(index)"
              />
            </div>
          </div>

          <UInput
            :model-value="item.alt ?? ''"
            placeholder="Alt text"
            size="xs"
            :ui="{ base: 'max-sm:text-base/4' }"
            @update:model-value="setAlt(index, String($event))"
          />
        </div>
      </div>
    </div>

    <div v-if="room" class="flex flex-wrap items-center gap-2">
      <MediaUpload
        :kind="kind"
        :multiple="multiple"
        color="neutral"
        variant="outline"
        @uploaded="insert"
      />

      <UButton
        label="Media library"
        icon="i-hugeicons-album-02"
        color="neutral"
        variant="ghost"
        @click="picking = true"
      />

      <UButton
        label="Use a URL"
        icon="i-hugeicons-link-01"
        color="neutral"
        variant="ghost"
        @click="linking = !linking"
      />
    </div>

    <div v-if="linking && room" class="flex items-center gap-2">
      <UInput
        v-model="url"
        placeholder="https://example.com/image.jpg"
        class="flex-1"
        @keydown.enter.prevent="link()"
      />

      <UButton label="Add" color="neutral" :disabled="!url.trim()" @click="link()" />
    </div>

    <MediaLibrary
      v-model:open="picking"
      :kind="kind"
      :multiple="multiple"
      @select="insert"
    />
  </div>
</template>
