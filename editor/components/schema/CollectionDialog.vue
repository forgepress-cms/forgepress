<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

export interface CollectionValues {
  label: string
  description: string
  key: string
}

const props = defineProps<{
  name: string
  label: string
  description: string
  loading: boolean
  validate: (key: string) => string
}>()

const emit = defineEmits<{ save: [values: CollectionValues] }>()

const open = defineModel<boolean>('open', { required: true })

const form = reactive<CollectionValues>({ label: '', description: '', key: '' })

const invalid = computed(() => form.key === props.name ? '' : props.validate(form.key))

watch(open, (value) => {
  if (value)
    Object.assign(form, { label: props.label, description: props.description, key: props.name })
})
</script>

<template>
  <UModal v-model:open="open" title="Edit collection" description="How the collection is called in the editor and in code.">
    <template #body>
      <div class="grid gap-4">
        <UFormField label="Name">
          <UInput v-model="form.label" :placeholder="name" class="w-full" />
        </UFormField>

        <UFormField label="Description" description="Shown on the Content and Schema pages.">
          <UTextarea v-model="form.description" :rows="2" class="w-full" />
        </UFormField>

        <UFormField label="Key" description="How the collection is referenced in queries and content files.">
          <UInput v-model="form.key" class="w-full font-mono" />
        </UFormField>

        <p v-if="invalid" class="text-sm text-error">
          {{ invalid }}
        </p>

        <p v-else-if="form.key !== name" class="text-sm text-muted">
          The entries move along. Code that asks for query('{{ name }}') needs query('{{ form.key }}').
        </p>
      </div>
    </template>

    <template #footer>
      <UButton label="Save" :loading="loading" :disabled="!!invalid" @click="emit('save', { ...form })" />

      <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
