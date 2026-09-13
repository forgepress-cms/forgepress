<script setup lang="ts">
import type { MediaKind } from '../../../media'

defineProps<{
  url: string
  kind: MediaKind
  alt?: string | undefined
}>()
</script>

<template>
  <video
    v-if="kind === 'video'"
    :src="url"
    class="size-full object-cover"
    muted
    playsinline
    preload="metadata"
  />

  <img
    v-else
    :src="url"
    :alt="alt ?? ''"
    class="size-full object-cover"
    loading="lazy"
  >
</template>
