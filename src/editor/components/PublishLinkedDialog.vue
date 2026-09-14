<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  entries: { key: string, collection: string, label: string }[]
}>()

const emit = defineEmits<{ publish: [], keep: [] }>()

const open = defineModel<boolean>('open', { required: true })

const single = computed(() => props.entries.length === 1)

const description = computed(() => {
  const linked = single.value ? 'an unpublished entry' : `${props.entries.length} unpublished entries`

  return `This entry links to ${linked}. Published entries can only link to published ones, or the site won't build.`
})
</script>

<template>
  <UModal v-model:open="open" title="Publish linked entries too?" :description="description">
    <template #body>
      <ul class="flex flex-col gap-2">
        <li v-for="entry in entries" :key="entry.key" class="flex min-w-0 items-center gap-2 text-sm">
          <UBadge :label="entry.collection" color="neutral" variant="subtle" size="sm" class="shrink-0" />

          <span class="truncate text-highlighted">{{ entry.label }}</span>
        </li>
      </ul>
    </template>

    <template #footer>
      <UButton :label="single ? 'Publish it too' : 'Publish them too'" @click="emit('publish')" />

      <UButton
        :label="single ? 'Keep it unpublished' : 'Keep them unpublished'"
        color="neutral"
        variant="outline"
        @click="emit('keep')"
      />

      <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
