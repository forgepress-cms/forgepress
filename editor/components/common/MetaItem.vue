<script setup lang="ts">
defineProps<{
  label: string
  value: string
  mono?: boolean
}>()
</script>

<template>
  <div class="flex items-baseline justify-between gap-3 text-sm">
    <span class="text-muted">{{ label }}</span>

    <span class="truncate text-xs text-highlighted" :class="mono && 'font-mono'">{{ value }}</span>
  </div>
</template>
