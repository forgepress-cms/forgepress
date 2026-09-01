<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description: string
  label?: string
}>(), { label: 'Delete' })

const emit = defineEmits<{ confirm: [] }>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #footer>
      <UButton :label="label" color="error" @click="emit('confirm')" />

      <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
