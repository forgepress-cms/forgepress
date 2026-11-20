<script setup lang="ts">
import type { PreviewAddress } from '../../../src/schema'
import { computed, reactive, watch } from 'vue'

export interface CollectionValues {
  label: string
  description: string
  key: string
  preview: PreviewAddress | undefined
  single: boolean
}

const props = defineProps<{
  name: string
  label: string
  description: string
  preview?: PreviewAddress | undefined
  locales: readonly string[]
  single?: boolean | undefined
  loading: boolean
  validate: (key: string) => string
}>()

const emit = defineEmits<{ save: [values: CollectionValues] }>()

const open = defineModel<boolean>('open', { required: true })

const form = reactive({ label: '', description: '', key: '', preview: '', perLocale: false, addresses: {} as Record<string, string>, single: false })

const invalid = computed(() => form.key === props.name ? '' : props.validate(form.key))

watch(open, (value) => {
  if (!value)
    return

  const preview = props.preview ?? ''
  const addresses = typeof preview === 'object' ? preview : {}

  Object.assign(form, {
    label: props.label,
    description: props.description,
    key: props.name,
    preview: typeof preview === 'string' ? preview : '',
    perLocale: typeof preview === 'object',
    addresses: Object.fromEntries(props.locales.map(code => [code, addresses[code] ?? ''])),
    single: props.single ?? false,
  })
})

watch(() => form.perLocale, (perLocale) => {
  if (!perLocale)
    return

  for (const code of props.locales)
    form.addresses[code] ||= form.preview
})

function preview(): PreviewAddress | undefined {
  if (!form.perLocale)
    return form.preview || undefined

  const addresses = Object.fromEntries(props.locales.flatMap(code => form.addresses[code] ? [[code, form.addresses[code]]] : []))

  return Object.keys(addresses).length > 0 ? addresses : undefined
}

function save(): void {
  emit('save', { label: form.label, description: form.description, key: form.key, preview: preview(), single: form.single })
}
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

        <UFormField v-if="preview !== undefined" label="Preview" description="The address of an entry on the site, with {id}, {locale} or a field in braces, such as /blog/{slug}.">
          <template v-if="locales.length" #hint>
            <USwitch v-model="form.perLocale" label="Per language" size="sm" />
          </template>

          <div v-if="form.perLocale" class="grid gap-2">
            <UInput
              v-for="code in locales"
              :key="code"
              :model-value="form.addresses[code] ?? ''"
              class="w-full font-mono"
              :aria-label="`Preview address for ${code.toUpperCase()}`"
              @update:model-value="form.addresses[code] = String($event)"
            >
              <template #leading>
                <span class="font-mono text-xs text-muted">{{ code.toUpperCase() }}</span>
              </template>
            </UInput>
          </div>

          <UInput v-else v-model="form.preview" class="w-full font-mono" />
        </UFormField>

        <UFormField v-if="single !== undefined" label="Single entry" description="The collection holds one entry, such as the settings of the site, and opens as a form instead of a list.">
          <USwitch v-model="form.single" />
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
      <UButton label="Save" :loading="loading" :disabled="!!invalid" @click="save()" />

      <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
