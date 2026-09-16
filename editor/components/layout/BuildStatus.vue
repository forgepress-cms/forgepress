<script setup lang="ts">
import type { BuildState } from '../../../src/forge/build'
import type { CheckState } from '../../../src/forge/types'
import { computed, onMounted } from 'vue'
import { commitUrl, describe } from '../../../src/forge/providers'
import { PATIENCE, useBuild } from '../../composables/useBuild'
import { useSession } from '../../composables/useSession'

interface Look {
  label: string
  icon: string
  color: 'neutral' | 'success' | 'error' | 'warning'
}

const STATES: Record<BuildState, Look> = {
  building: { label: 'Building', icon: 'i-hugeicons-loading-03', color: 'neutral' },
  passed: { label: 'Built', icon: 'i-hugeicons-checkmark-circle-02', color: 'success' },
  live: { label: 'Live', icon: 'i-hugeicons-checkmark-circle-02', color: 'success' },
  failed: { label: 'Build failed', icon: 'i-hugeicons-cancel-circle', color: 'error' },
  stalled: { label: 'Not live yet', icon: 'i-hugeicons-clock-alert', color: 'warning' },
}

const CHECKS: Record<CheckState, { icon: string, class: string, label: string }> = {
  pending: { icon: 'i-hugeicons-loading-03', class: 'animate-spin text-muted', label: 'Running' },
  success: { icon: 'i-hugeicons-checkmark-circle-02', class: 'text-success', label: 'Passed' },
  failure: { icon: 'i-hugeicons-cancel-circle', class: 'text-error', label: 'Failed' },
  skipped: { icon: 'i-hugeicons-minus-sign-circle', class: 'text-dimmed', label: 'Skipped' },
}

const { commit, state, checks, error, restore, retry, dismiss } = useBuild()
const { provider } = useSession()

onMounted(restore)

const look = computed(() => state.value ? STATES[state.value] : undefined)
const short = computed(() => commit.value.slice(0, 7))
const forge = computed(() => provider.value ? describe(provider.value).name : '')
const link = computed(() => provider.value && commit.value ? commitUrl(provider.value, commit.value) : '')

const title = computed(() => {
  switch (state.value) {
    case 'live': return `${short.value} is live`
    case 'passed': return `${short.value} is built`
    case 'failed': return `The build of ${short.value} failed`
    case 'stalled': return `${short.value} isn't live yet`
    default: return `Building ${short.value}`
  }
})

const detail = computed(() => {
  switch (state.value) {
    case 'live': return 'The site shows this commit, or a newer one that includes it.'
    case 'passed': return 'The site doesn\'t say which commit it was built from, so the editor can\'t tell when it\'s live.'
    case 'failed': return 'The site keeps showing the previous version until a build succeeds.'
    case 'stalled': return `The site didn't show this commit within ${PATIENCE / 60_000} minutes.`
    default:
      if (checks.value.length === 0)
        return `No build has reported to ${forge.value} yet. The site updates once one is deployed.`

      return checks.value.some(check => check.state === 'pending')
        ? 'The site updates once the build is deployed.'
        : 'The build passed. Waiting for the site to update.'
  }
})
</script>

<template>
  <UPopover v-if="look">
    <UButton
      :label="look.label"
      :icon="look.icon"
      :color="look.color"
      variant="soft"
      :ui="{ label: 'max-sm:sr-only', leadingIcon: state === 'building' ? 'animate-spin' : '' }"
    />

    <template #content>
      <div class="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4 text-sm">
        <div>
          <p class="font-medium text-highlighted">
            {{ title }}
          </p>

          <p class="text-muted">
            {{ detail }}
          </p>
        </div>

        <ul v-if="checks.length" class="flex flex-col gap-1.5">
          <li v-for="(check, index) in checks" :key="index" class="flex items-center gap-2">
            <UIcon
              :name="CHECKS[check.state].icon"
              class="size-4 shrink-0"
              :class="CHECKS[check.state].class"
              role="img"
              :aria-label="CHECKS[check.state].label"
            />

            <span class="min-w-0 flex-1 truncate" :title="check.name">{{ check.name }}</span>

            <UButton
              v-if="check.url"
              :to="check.url"
              target="_blank"
              label="Details"
              variant="link"
              size="xs"
              class="shrink-0"
            />
          </li>
        </ul>

        <p v-if="error" class="text-xs break-words text-muted">
          Couldn't read the checks: {{ error }}
        </p>

        <div class="flex items-center gap-2">
          <UButton
            v-if="link"
            :to="link"
            target="_blank"
            :label="`Open on ${forge}`"
            color="neutral"
            variant="link"
            trailing-icon="i-hugeicons-link-square-02"
            class="me-auto px-0"
          />

          <UButton
            v-if="state === 'failed' || state === 'stalled'"
            label="Check again"
            color="neutral"
            variant="outline"
            size="sm"
            @click="retry()"
          />

          <UButton label="Dismiss" color="neutral" variant="ghost" size="sm" @click="dismiss()" />
        </div>
      </div>
    </template>
  </UPopover>
</template>
