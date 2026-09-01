<script setup lang="ts">
defineProps<{
  title: string
  error: string
}>()
</script>

<template>
  <UAlert
    v-if="error"
    :title="title"
    :description="error"
    color="error"
    variant="subtle"
    icon="i-lucide-triangle-alert"
  />
</template>
