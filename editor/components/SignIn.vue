<script setup lang="ts">
import { computed, ref } from 'vue'
import { describe } from '../../src/forge/providers'
import { useSession } from '../composables/useSession'
import { useTitle } from '../composables/useTitle'
import ErrorAlert from './ErrorAlert.vue'

const { provider, pending, error, redirects, signIn, signInWithForge } = useSession()

useTitle('Sign in to edit')

const token = ref('')

const forge = computed(() => provider.value ? describe(provider.value) : undefined)

const name = computed(() => forge.value?.name ?? '')

const repository = computed(() => {
  const config = provider.value

  return config ? `${config.repository.owner}/${config.repository.name}` : ''
})
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center p-6">
    <UPageCard
      variant="ghost"
      class="sheet w-full max-w-md"
      title="Sign in to edit"
      :description="repository ? `Publishing to ${repository}` : 'No repository is configured.'"
    >
      <div v-if="redirects" class="flex flex-col gap-4">
        <ErrorAlert title="Sign-in failed" :error="error" />

        <UButton
          :label="`Sign in with ${name}`"
          :loading="pending"
          trailing-icon="i-hugeicons-arrow-right-02"
          block
          @click="signInWithForge()"
        />
      </div>

      <form v-else class="flex flex-col gap-4" @submit.prevent="signIn(token)">
        <UFormField
          label="Access token"
          :help="`A ${name} token limited to this repository, with ${forge?.permissions ?? 'permission to write repository contents'}.`"
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

        <ErrorAlert title="Sign-in failed" :error="error" />

        <UButton type="submit" label="Sign in" :loading="pending" :disabled="!provider" block />

        <UButton
          :to="forge?.tokens ?? ''"
          target="_blank"
          :label="`Create a token on ${name}`"
          color="neutral"
          variant="link"
          trailing-icon="i-hugeicons-link-square-02"
          block
        />
      </form>
    </UPageCard>
  </div>
</template>
