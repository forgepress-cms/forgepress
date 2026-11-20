<script setup lang="ts">
defineSlots<{
  default?: () => unknown
  sidebar?: () => unknown
}>()
</script>

<template>
  <div class="grid grid-cols-1 items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_18rem]">
    <div class="sheet grid grid-cols-1 gap-6 rounded-lg p-4 @min-[40rem]:gap-8 @min-[40rem]:p-8">
      <slot />
    </div>

    <aside v-if="$slots.sidebar" class="sheet grid grid-cols-1 gap-4 rounded-lg p-4 @min-[40rem]:p-6 @5xl:sticky @5xl:top-20">
      <slot name="sidebar" />
    </aside>
  </div>
</template>
