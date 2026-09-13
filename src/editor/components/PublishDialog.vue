<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePublish } from '../composables/usePublish'
import { useSession } from '../composables/useSession'
import DiffView from './DiffView.vue'

const open = defineModel<boolean>('open', { required: true })

const { diff, count, publishing, error, refresh, publish } = usePublish()
const { branch } = useSession()

const name = ref('')
const commit = ref('')
const loading = ref(false)

watch(open, async (value) => {
  if (!value)
    return

  commit.value = ''
  loading.value = true

  try {
    await refresh()
  }
  finally {
    loading.value = false
  }
}, { immediate: true })

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
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UAlert
          v-if="commit"
          color="success"
          variant="soft"
          :title="`Published as ${commit.slice(0, 7)}`"
          description="The site rebuilds from this commit. New media keeps its preview here until it does."
        />

        <div v-if="loading" class="flex justify-center py-6">
          <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-muted" />
        </div>

        <p v-else-if="!count" class="py-2 text-sm text-muted">
          Nothing has changed yet.
        </p>

        <DiffView v-else :diff="diff" />

        <UFormField label="What changed?" help="Becomes the commit message.">
          <UInput v-model="name" placeholder="new pricing page" class="w-full" :disabled="!count" />
        </UFormField>

        <UAlert v-if="error" color="error" variant="soft" :description="error" />
      </div>
    </template>

    <template #footer>
      <UButton label="Publish" :loading="publishing" :disabled="!count" @click="submit()" />

      <UButton label="Close" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
