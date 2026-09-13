<script setup lang="ts">
import type { ProviderType } from '../../types/config'
import { computed, ref } from 'vue'
import { describe } from '../../forge'
import { useSession } from '../composables/useSession'

const { provider, pending, error, redirects, signIn, signInWithForge } = useSession()

const token = ref('')

const NAMES: Record<ProviderType, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  forgejo: 'Forgejo',
}

const name = computed(() => provider.value ? NAMES[provider.value.type] : '')

const repository = computed(() => {
  const config = provider.value

  return config ? `${config.repository.owner}/${config.repository.name}` : ''
})

const PATHS: Record<ProviderType, string> = {
  github: '/settings/personal-access-tokens/new',
  gitlab: '/-/user_settings/personal_access_tokens',
  forgejo: '/user/settings/applications',
}

const tokens = computed(() => {
  const config = provider.value

  return config ? `${describe(config).root}${PATHS[config.type]}` : ''
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center p-6">
    <UPageCard
      class="w-full max-w-md"
      title="Sign in to edit"
      :description="repository ? `Publishing to ${repository}` : 'No repository is configured.'"
    >
      <div v-if="redirects" class="flex flex-col gap-4">
        <UAlert v-if="error" color="error" variant="soft" :description="error" />

        <UButton
          :label="`Sign in with ${name}`"
          :loading="pending"
          trailing-icon="i-lucide-arrow-right"
          block
          @click="signInWithForge()"
        />
      </div>

      <form v-else class="flex flex-col gap-4" @submit.prevent="signIn(token)">
        <UFormField
          label="Access token"
          :help="`A ${name} token limited to this repository, with permission to write repository contents.`"
        >
          <UInput
            v-model="token"
            type="password"
            placeholder="••••••••••••••••"
            autocomplete="off"
            class="w-full"
            :disabled="!provider"
          />
        </UFormField>

        <UAlert v-if="error" color="error" variant="soft" :description="error" />

        <UButton type="submit" label="Sign in" :loading="pending" :disabled="!provider" block />

        <UButton
          :to="tokens"
          target="_blank"
          :label="`Create a token on ${name}`"
          color="neutral"
          variant="link"
          trailing-icon="i-lucide-external-link"
          block
        />
      </form>
    </UPageCard>
  </div>
</template>
