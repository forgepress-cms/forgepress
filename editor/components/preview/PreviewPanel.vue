<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import { usePreviewPane } from '../../composables'

const pane = usePreviewPane()!
const { address, hint, loading, locale, locales, resizing, url } = pane

const frame = useTemplateRef<HTMLIFrameElement>('frame')

watch(frame, (element, _, onCleanup) => {
  if (element)
    onCleanup(pane.attach(element))
}, { flush: 'post' })

const languages = computed(() => locales.value.map(value => ({ label: value.toUpperCase(), value })))

const language = computed({
  get: () => locale.value ?? '',
  set: (value: string) => {
    locale.value = value
  },
})
const external = computed(() => url.value === undefined ? undefined : new URL(address.value || url.value, window.location.href).href)
</script>

<template>
  <section class="flex h-full min-h-0 min-w-0 flex-col bg-default" aria-label="Preview">
    <div class="flex h-(--ui-header-height) shrink-0 items-center gap-1 border-b border-default ps-4 pe-2">
      <UIcon :name="loading ? 'i-hugeicons-loading-03' : 'i-hugeicons-view'" class="size-4 shrink-0 text-muted" :class="loading && 'animate-spin'" />

      <span class="min-w-0 flex-1 truncate ps-1 font-mono text-xs text-muted" :title="address">{{ address }}</span>

      <USelect
        v-if="languages.length > 1"
        v-model="language"
        :items="languages"
        value-key="value"
        size="sm"
        variant="ghost"
        aria-label="Language of the preview"
        class="w-20 shrink-0"
      />

      <UButton
        icon="i-hugeicons-reload"
        color="neutral"
        variant="ghost"
        aria-label="Reload the preview"
        title="Reload"
        :disabled="!url"
        @click="pane.reload()"
      />

      <UButton
        v-bind="external ? { to: external, target: '_blank' } : {}"
        icon="i-hugeicons-arrow-up-right-01"
        color="neutral"
        variant="ghost"
        aria-label="Open the preview in a new tab"
        title="Open in a new tab"
        :disabled="!url"
      />

      <UButton
        icon="i-hugeicons-cancel-01"
        color="neutral"
        variant="ghost"
        aria-label="Close the preview"
        title="Close"
        @click="pane.close()"
      />
    </div>

    <iframe
      v-if="url"
      ref="frame"
      title="Preview of the site"
      class="block min-h-0 w-full flex-1 border-0"
      :class="resizing && 'pointer-events-none'"
    />

    <p v-else class="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm text-muted">
      {{ hint }}
    </p>
  </section>
</template>
