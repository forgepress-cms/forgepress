<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePublish } from '../composables/usePublish'
import { useSession } from '../composables/useSession'

const open = defineModel<boolean>('open', { required: true })

const { summary, count, publishing, error, refresh, publish } = usePublish()
const { branch } = useSession()

const name = ref('')
const commit = ref('')

watch(open, async (value) => {
  if (!value)
    return

  commit.value = ''

  await refresh()
}, { immediate: true })

const entries = computed(() => {
  const current = summary.value

  return [
    ...current.schema ? [{ label: 'Schema', detail: 'changed' }] : [],
    ...current.written.map(component => ({ label: component, detail: 'content' })),
    ...current.removed.map(component => ({ label: component, detail: 'removed' })),
    ...current.uploads.map(asset => ({ label: asset, detail: 'upload' })),
    ...current.deleted.map(asset => ({ label: asset, detail: 'deleted' })),
  ]
})

async function submit(): Promise<void> {
  const published = await publish(name.value)

  if (!published)
    return

  commit.value = published
  name.value = ''
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Publish changes"
    :description="branch ? `Commits straight to ${branch}.` : 'Commits straight to the default branch.'"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UAlert
          v-if="commit"
          color="success"
          variant="soft"
          :title="`Published as ${commit.slice(0, 7)}`"
          description="The site rebuilds from this commit. Your local copy stays until it does."
        />

        <UAlert
          v-else-if="summary.published"
          color="neutral"
          variant="soft"
          :title="`Already published as ${summary.published.slice(0, 7)}`"
          description="Waiting for the site to rebuild. Editing again starts a new change."
        />

        <p v-if="!entries.length" class="text-sm text-muted">
          Nothing has changed yet.
        </p>

        <ul v-else class="flex flex-col gap-1">
          <li v-for="entry in entries" :key="`${entry.detail}:${entry.label}`" class="flex items-center justify-between gap-3 text-sm">
            <span class="truncate font-medium text-highlighted">{{ entry.label }}</span>

            <UBadge :label="entry.detail" color="neutral" variant="subtle" size="sm" />
          </li>
        </ul>

        <UFormField label="What changed?" help="Becomes the commit message.">
          <UInput v-model="name" placeholder="new pricing page" class="w-full" :disabled="!count" />
        </UFormField>

        <UAlert v-if="error" color="error" variant="soft" :description="error" />
      </div>
    </template>

    <template #footer>
      <UButton
        label="Publish"
        :loading="publishing"
        :disabled="!count"
        @click="submit()"
      />

      <UButton label="Close" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
