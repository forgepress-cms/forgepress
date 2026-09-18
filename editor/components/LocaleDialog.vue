<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { localeName } from '../utils/locale'

const props = defineProps<{
  title: string
  description: string
  label: string
  loading: boolean
  code?: string | undefined
  primary: boolean
  validate: (code: string) => string
}>()

const emit = defineEmits<{ save: [code: string, primary: boolean] }>()

const open = defineModel<boolean>('open', { required: true })

const code = ref('')
const primary = ref(false)

const trimmed = computed(() => code.value.trim())
const invalid = computed(() => props.validate(trimmed.value))
const name = computed(() => trimmed.value ? localeName(trimmed.value) : undefined)

watch(open, (value) => {
  if (value) {
    code.value = props.code ?? ''
    primary.value = props.primary
  }
})

function save(): void {
  if (!invalid.value)
    emit('save', trimmed.value, primary.value)
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #body>
      <div class="grid gap-4">
        <UFormField label="Code" description="A language tag such as en, de or pt-BR. Queries ask for it with .locale().">
          <UInput v-model="code" class="w-full font-mono" @keydown.enter="save()" />
        </UFormField>

        <p v-if="trimmed && invalid" class="text-sm text-error">
          {{ invalid }}
        </p>

        <p v-else-if="name" class="text-sm text-muted">
          {{ name }}
        </p>

        <UCheckbox
          v-model="primary"
          label="Default locale"
          :description="props.primary ? (props.code ? 'Make another locale the default to change this.' : 'The first locale is the default.') : ''"
          :disabled="props.primary"
        />

        <slot />
      </div>
    </template>

    <template #footer>
      <UButton :label="label" :loading="loading" :disabled="!!invalid" @click="save()" />

      <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
