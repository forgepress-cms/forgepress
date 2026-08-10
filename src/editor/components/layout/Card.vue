<script setup lang="ts">
defineProps<{
  to?: string
}>()
</script>

<template>
  <component :is="to ? 'a' : 'div'" :href="to" class="rounded-lg border border-line bg-panel p-5">
    <slot />
  </component>
</template>
