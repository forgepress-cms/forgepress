<script setup lang="ts">
import type { Entries } from '../../composables/useEntries'
import { computed } from 'vue'
import { useRouter } from '../../composables/useRouter'
import ListSelect from './ListSelect.vue'

const props = defineProps<{
  component: string
  multiple?: boolean | undefined
  entries: Entries
}>()

const model = defineModel<string | string[]>({ required: true })

const { navigate } = useRouter()

const selected = computed({
  get: () => {
    const value = model.value

    return (Array.isArray(value) ? value : [value]).filter(Boolean) as string[]
  },
  set: (value) => {
    model.value = props.multiple ? value : value[0] ?? ''
  },
})

const items = computed(() => props.entries.options(props.component))
</script>

<template>
  <ListSelect
    v-model="selected"
    :items="items"
    :multiple="multiple"
    :placeholder="`Add ${multiple ? 'an entry' : 'the entry'}`"
    :open="id => navigate(`content/${component}/${id}`)"
  />
</template>
