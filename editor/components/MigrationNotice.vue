<script setup lang="ts">
import type { SchemaEditor } from '../composables/useSchema'
import { onMounted, ref } from 'vue'

const props = defineProps<{
  editor: SchemaEditor
}>()

const mismatched = ref(0)

onMounted(async () => {
  mismatched.value = await props.editor.mismatch().catch(() => 0)
})

async function repair(): Promise<void> {
  if (await props.editor.repair())
    mismatched.value = 0
}

async function dismiss(): Promise<void> {
  await props.editor.dismiss()
  mismatched.value = 0
}
</script>

<template>
  <UAlert
    v-if="mismatched"
    color="warning"
    variant="subtle"
    icon="i-hugeicons-alert-02"
    title="Content doesn't match the schema"
    :description="`${mismatched} ${mismatched === 1 ? 'entry doesn\'t' : 'entries don\'t'} fit the schema anymore, for example after schema.ts was edited by hand or a branch was merged.`"
    :actions="[
      { label: 'Review', color: 'warning', onClick: repair },
      ...editor.state.value.outstanding ? [{ label: 'Dismiss', color: 'neutral' as const, variant: 'ghost' as const, onClick: dismiss }] : [],
    ]"
  />
</template>
