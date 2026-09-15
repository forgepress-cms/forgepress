<script setup lang="ts">
import type { MediaAsset } from '../../../media/types'
import { mediaKind } from '../../../media'
import { formatSize } from '../../utils/media'
import MediaPreview from './MediaPreview.vue'

const props = defineProps<{
  assets: MediaAsset[]
  multiple?: boolean | undefined
  onOpen?: (asset: MediaAsset) => void
  onRemove?: (asset: MediaAsset) => void
}>()

const selected = defineModel<string[]>({ required: true })

function toggle(asset: MediaAsset): void {
  if (selected.value.includes(asset.name))
    selected.value = selected.value.filter(name => name !== asset.name)
  else
    selected.value = props.multiple ? [...selected.value, asset.name] : [asset.name]
}

function activate(asset: MediaAsset): void {
  if (props.onOpen)
    props.onOpen(asset)
  else
    toggle(asset)
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
    <div
      v-for="asset in assets"
      :key="asset.name"
      class="group relative overflow-hidden rounded-lg border bg-default transition"
      :class="selected.includes(asset.name) ? 'border-primary ring-2 ring-primary/30' : 'border-default hover:border-accented'"
    >
      <button
        type="button"
        class="block w-full cursor-pointer text-left"
        :aria-label="onOpen ? `Show ${asset.name}` : undefined"
        :aria-pressed="onOpen ? undefined : selected.includes(asset.name)"
        @click="activate(asset)"
      >
        <span class="block aspect-video bg-elevated">
          <MediaPreview :url="asset.preview ?? asset.url" :kind="mediaKind(asset.name) ?? 'image'" :alt="asset.name" />
        </span>

        <span class="grid gap-0.5 px-2 py-1.5">
          <span class="truncate text-xs font-medium text-highlighted">{{ asset.name }}</span>

          <span v-if="asset.size !== undefined" class="text-xs text-muted">{{ formatSize(asset.size) }}</span>
        </span>
      </button>

      <UCheckbox
        v-if="onOpen"
        :model-value="selected.includes(asset.name)"
        :aria-label="`Select ${asset.name}`"
        class="absolute left-1.5 top-1.5"
        :ui="{ container: 'h-6', base: 'size-6 rounded-md bg-default shadow-sm', icon: 'size-4' }"
        @update:model-value="toggle(asset)"
      />

      <UButton
        v-if="onRemove"
        icon="i-lucide-trash-2"
        color="error"
        variant="solid"
        size="xs"
        class="absolute right-1.5 top-1.5 bg-default text-default opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-error hover:text-inverted focus-visible:bg-error focus-visible:text-inverted focus-visible:opacity-100"
        :aria-label="`Delete ${asset.name}`"
        @click="onRemove?.(asset)"
      />
    </div>
  </div>
</template>
