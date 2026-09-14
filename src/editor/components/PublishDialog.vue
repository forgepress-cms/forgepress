<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePublish } from '../composables/usePublish'
import { useRouter } from '../composables/useRouter'
import { useSession } from '../composables/useSession'
import DiffView from './DiffView.vue'
import ErrorAlert from './ErrorAlert.vue'

const open = defineModel<boolean>('open', { required: true })

const { diff, count, publishing, error, conflicts, issues, refresh, publish, resolve } = usePublish()
const { branch } = useSession()
const { reload, href } = useRouter()

const name = ref('')
const commit = ref('')
const loading = ref(false)

let changed = false

watch(open, async (value) => {
  if (!value) {
    if (changed)
      reload()

    changed = false

    return
  }

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

  if (published || conflicts.value.length > 0 || issues.value.length > 0)
    changed = true

  if (!published)
    return

  commit.value = published
  name.value = ''
}

async function drop(): Promise<void> {
  if (await resolve('theirs'))
    changed = true
}

async function overwrite(): Promise<void> {
  if (await resolve('mine'))
    await submit()
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

        <UAlert
          v-if="conflicts.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Changed in the repository since your edit"
          :actions="[
            { label: 'Drop my edits', color: 'neutral', variant: 'outline', disabled: publishing, onClick: drop },
            { label: 'Publish mine anyway', color: 'warning', loading: publishing, onClick: overwrite },
          ]"
        >
          <template #description>
            <p>Publishing would undo those changes. Below, your version is now compared with the current one.</p>

            <ul class="mt-2 font-mono text-xs">
              <li v-for="conflict in conflicts" :key="conflict.path">
                {{ conflict.path }}{{ conflict.hash === null ? ' (deleted)' : '' }}
              </li>
            </ul>
          </template>
        </UAlert>

        <UAlert
          v-if="issues.length"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-x"
          title="The site wouldn't build"
        >
          <template #description>
            <p>Nothing was published. The repository with your changes has these problems:</p>

            <ul class="mt-2 flex flex-col gap-2">
              <li v-for="file in issues" :key="file.path">
                <a
                  v-if="file.entry"
                  :href="href(`content/${file.entry.collection}/${file.entry.id}`)"
                  class="font-mono text-xs text-highlighted underline"
                  @click="open = false"
                >{{ file.path }}</a>

                <span v-else class="font-mono text-xs text-highlighted">{{ file.path }}</span>

                <ul class="mt-1 list-disc pl-4">
                  <li v-for="(message, index) in file.messages" :key="index">
                    {{ message }}
                  </li>
                </ul>
              </li>
            </ul>
          </template>
        </UAlert>

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

        <ErrorAlert title="Publishing failed" :error="error" />
      </div>
    </template>

    <template #footer>
      <UButton label="Publish" :loading="publishing" :disabled="!count" @click="submit()" />

      <UButton label="Close" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </UModal>
</template>
