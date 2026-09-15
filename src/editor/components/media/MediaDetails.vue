<script setup lang="ts">
import type { MediaAsset } from '../../../media/types'
import type { Size } from '../../utils/media'
import { computed, shallowRef, watch } from 'vue'
import { mediaKind } from '../../../media'
import { formatSize, measure } from '../../utils/media'
import MetaItem from '../MetaItem.vue'
import MediaPreview from './MediaPreview.vue'

const props = defineProps<{
  asset: MediaAsset | undefined
}>()

const emit = defineEmits<{ remove: [MediaAsset] }>()

const open = defineModel<boolean>('open', { required: true })

const size = shallowRef<Size>()
const measuring = shallowRef(false)

const kind = computed(() => props.asset && mediaKind(props.asset.name) === 'video' ? 'video' : 'image')

watch(() => props.asset, async (asset) => {
  size.value = undefined
  measuring.value = !!asset

  if (!asset)
    return

  const measured = await measure(asset.preview ?? asset.url, kind.value)

  if (props.asset !== asset)
    return

  size.value = measured
  measuring.value = false
}, { immediate: true })

function pixels(value: number | undefined): string {
  if (measuring.value)
    return '…'

  return value === undefined ? 'Unknown' : `${value} px`
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="asset?.name ?? ''"
    :description="asset?.type ?? ''"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div v-if="asset" class="grid gap-4">
        <div class="h-80 overflow-hidden rounded-md bg-elevated">
          <MediaPreview :url="asset.preview ?? asset.url" :kind="kind" :alt="asset.name" fit="contain" controls />
        </div>

        <div class="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <MetaItem label="Name" :value="asset.name" mono />

          <MetaItem v-if="asset.size !== undefined" label="File size" :value="formatSize(asset.size)" />

          <MetaItem label="Width" :value="pixels(size?.width)" />

          <MetaItem label="Height" :value="pixels(size?.height)" />

          <MetaItem v-if="asset.modifiedAt" label="Modified" :value="new Date(asset.modifiedAt).toLocaleString()" />

          <MetaItem label="URL" :value="asset.url" mono />
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        label="Delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="subtle"
        :disabled="!asset"
        @click="asset && emit('remove', asset)"
      />

      <UButton label="Close" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
