<script setup lang="ts">
defineSlots<{
  default?: () => unknown
  sidebar?: () => unknown
}>()
</script>

<template>
  <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div class="sheet grid grid-cols-1 gap-6 rounded-lg p-4 sm:gap-8 sm:p-8">
      <slot />
    </div>

    <aside v-if="$slots.sidebar" class="sheet grid grid-cols-1 gap-4 rounded-lg p-4 sm:p-6 lg:sticky lg:top-20">
      <slot name="sidebar" />
    </aside>
  </div>
</template>
