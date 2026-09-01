<script setup lang="ts">
defineSlots<{
  default?: () => unknown
  sidebar?: () => unknown
}>()
</script>

<template>
  <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div class="grid gap-8 rounded-lg border border-default bg-default p-6">
      <slot />
    </div>

    <aside v-if="$slots.sidebar" class="grid gap-4 rounded-lg border border-default bg-default p-4 lg:sticky lg:top-20">
      <slot name="sidebar" />
    </aside>
  </div>
</template>
