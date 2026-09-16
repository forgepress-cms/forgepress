<script setup lang="ts">
import type { MediaKind } from '../../../src/media'
import type { MediaAsset } from '../../../src/media/types'
import { ref } from 'vue'
import { mediaAccept } from '../../../src/media'
import { useMedia } from '../../composables/useMedia'

const props = withDefaults(defineProps<{
  kind?: MediaKind | undefined
  multiple?: boolean | undefined
  label?: string
  color?: 'primary' | 'neutral'
  variant?: 'solid' | 'outline' | 'subtle' | 'ghost'
}>(), { label: 'Upload', color: 'primary', variant: 'solid' })

const emit = defineEmits<{ uploaded: [MediaAsset[]] }>()

const library = useMedia()

const input = ref<HTMLInputElement>()

async function pick(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const files = [...target.files ?? []]

  target.value = ''

  if (files.length)
    emit('uploaded', await library.upload(props.multiple ? files : files.slice(0, 1)))
}
</script>

<template>
  <span class="contents">
    <UButton
      :label="label"
      icon="i-hugeicons-upload-01"
      :color="color"
      :variant="variant"
      :loading="library.pending.value"
      @click="input?.click()"
    />

    <input
      ref="input"
      type="file"
      class="hidden"
      :accept="mediaAccept(kind)"
      :multiple="multiple"
      @change="pick"
    >
  </span>
</template>
