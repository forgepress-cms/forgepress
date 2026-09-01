<script setup lang="ts">
import ConfirmDialog from './ConfirmDialog.vue'

withDefaults(defineProps<{ description?: string | undefined }>(), {
  description: 'The changes you made are lost if you leave now.',
})

const emit = defineEmits<{ confirm: [] }>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <ConfirmDialog
    v-model:open="open"
    title="Discard changes"
    :description="description"
    label="Discard"
    @confirm="emit('confirm')"
  />
</template>
