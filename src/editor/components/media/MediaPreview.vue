<script setup lang="ts">
import type { MediaKind } from '../../../media'

withDefaults(defineProps<{
  url: string
  kind: MediaKind
  alt?: string | undefined
  fit?: 'cover' | 'contain'
  controls?: boolean
}>(), { fit: 'cover', controls: false })
</script>

<template>
  <video
    v-if="kind === 'video'"
    :src="url"
    class="size-full"
    :class="fit === 'contain' ? 'object-contain' : 'object-cover'"
    :controls="controls"
    muted
    playsinline
    preload="metadata"
  />

  <img
    v-else
    :src="url"
    :alt="alt ?? ''"
    class="size-full"
    :class="fit === 'contain' ? 'object-contain' : 'object-cover'"
    loading="lazy"
  >
</template>
