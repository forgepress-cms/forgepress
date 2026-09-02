<script setup lang="ts">
withDefaults(defineProps<{
  description?: string | undefined
  saveable?: boolean | undefined
  loading?: boolean | undefined
}>(), {
  description: 'The changes you made are lost if you leave now.',
})

const emit = defineEmits<{ confirm: [], save: [] }>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal v-model:open="open" title="Unsaved changes" :description="description">
    <template #footer>
      <UButton
        v-if="saveable"
        label="Save and leave"
        icon="i-lucide-save"
        :loading="loading"
        @click="emit('save')"
      />

      <UButton
        label="Discard"
        color="error"
        :variant="saveable ? 'subtle' : 'solid'"
        @click="emit('confirm')"
      />

      <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
