<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toKey } from '../utils/schema'

const props = defineProps<{
  title: string
  description: string
  keyDescription: string
  loading: boolean
  validate: (key: string) => string
}>()

const emit = defineEmits<{ create: [label: string, key: string] }>()

defineSlots<{
  default?: () => unknown
}>()

const open = defineModel<boolean>('open', { required: true })

const label = ref('')
const key = ref('')
const touched = ref(false)

const invalid = computed(() => props.validate(key.value))

watch(open, (value) => {
  if (!value)
    return

  label.value = ''
  key.value = ''
  touched.value = false
})

function rename(value: string): void {
  label.value = value

  if (!touched.value)
    key.value = toKey(value)
}

function rekey(value: string): void {
  key.value = value
  touched.value = true
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #body>
      <div class="grid gap-4">
        <UFormField label="Name">
          <UInput :model-value="label" class="w-full" @update:model-value="rename(String($event))" />
        </UFormField>

        <UFormField label="Key" :description="keyDescription">
          <UInput :model-value="key" class="w-full font-mono" @update:model-value="rekey(String($event))" />
        </UFormField>

        <slot />

        <p v-if="key && invalid" class="text-sm text-error">
          {{ invalid }}
        </p>
      </div>
    </template>

    <template #footer>
      <UButton label="Create" :loading="loading" :disabled="!!invalid" @click="emit('create', label, key)" />

      <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
