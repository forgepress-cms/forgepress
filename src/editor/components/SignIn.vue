<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSession } from '../composables/useSession'

const { provider, pending, error, signIn } = useSession()

const token = ref('')

const repository = computed(() => {
  const config = provider.value

  return config ? `${config.repository.owner}/${config.repository.name}` : ''
})

const settings = computed(() => `https://github.com/settings/personal-access-tokens/new`)
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center p-6">
    <UPageCard
      class="w-full max-w-md"
      title="Sign in to edit"
      :description="repository ? `Publishing to ${repository}` : 'No repository is configured.'"
    >
      <form class="flex flex-col gap-4" @submit.prevent="signIn(token)">
        <UFormField
          label="Access token"
          help="A fine-grained token with Contents: read and write on this repository."
        >
          <UInput
            v-model="token"
            type="password"
            placeholder="github_pat_…"
            autocomplete="off"
            class="w-full"
            :disabled="!provider"
          />
        </UFormField>

        <UAlert v-if="error" color="error" variant="soft" :description="error" />

        <UButton type="submit" label="Sign in" :loading="pending" :disabled="!provider" block />

        <UButton
          :to="settings"
          target="_blank"
          label="Create a token on GitHub"
          color="neutral"
          variant="link"
          trailing-icon="i-lucide-external-link"
          block
        />
      </form>
    </UPageCard>
  </div>
</template>
