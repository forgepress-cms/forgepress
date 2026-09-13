<script setup lang="ts">
import type { MediaAsset } from '../../../media/types'
import { mediaKind } from '../../../media'
import { formatSize } from '../../utils/media'
import MediaPreview from './MediaPreview.vue'

const props = defineProps<{
  assets: MediaAsset[]
  multiple?: boolean | undefined
  removable?: boolean | undefined
}>()

const emit = defineEmits<{ remove: [MediaAsset] }>()

const selected = defineModel<string[]>({ required: true })

function toggle(asset: MediaAsset): void {
  if (selected.value.includes(asset.name))
    selected.value = selected.value.filter(name => name !== asset.name)
  else
    selected.value = props.multiple ? [...selected.value, asset.name] : [asset.name]
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
    <div
      v-for="asset in assets"
      :key="asset.name"
      class="group relative cursor-pointer overflow-hidden rounded-lg border bg-default transition"
      :class="selected.includes(asset.name) ? 'border-primary ring-2 ring-primary/30' : 'border-default hover:border-accented'"
      @click="toggle(asset)"
    >
      <div class="aspect-video bg-elevated">
        <MediaPreview :url="asset.preview ?? asset.url" :kind="mediaKind(asset.name) ?? 'image'" :alt="asset.name" />
      </div>

      <div class="grid gap-0.5 px-2 py-1.5">
        <span class="truncate text-xs font-medium text-highlighted">{{ asset.name }}</span>

        <span class="text-xs text-dimmed">{{ formatSize(asset.size) }}</span>
      </div>

      <UButton
        v-if="removable"
        icon="i-lucide-trash-2"
        color="error"
        variant="solid"
        size="xs"
        class="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100"
        :aria-label="`Delete ${asset.name}`"
        @click.stop="emit('remove', asset)"
      />
    </div>
  </div>
</template>
