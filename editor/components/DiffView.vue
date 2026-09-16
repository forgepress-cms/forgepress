<script setup lang="ts">
import type { FileDiff } from '../../src/changes/types'
import { computed, ref } from 'vue'
import { counts } from '../../src/changes/lines'
import { mediaKind } from '../../src/media'
import MediaPreview from './media/MediaPreview.vue'

const props = defineProps<{
  diff: FileDiff[]
}>()

const expanded = ref('')

const COLORS = {
  added: 'success',
  changed: 'warning',
  removed: 'error',
} as const

const entries = computed(() => props.diff.map(file => ({
  ...file,
  tally: file.lines ? counts(file.lines) : undefined,
  media: file.before ?? file.after,
})))

function toggle(path: string): void {
  expanded.value = expanded.value === path ? '' : path
}

function sign(kind: string): string {
  return kind === 'add' ? '+' : kind === 'remove' ? '-' : ' '
}
</script>

<template>
  <div v-if="entries.length" class="divide-y divide-default overflow-hidden rounded-md ring ring-default">
    <div v-for="file in entries" :key="file.path">
      <button
        type="button"
        class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-elevated/50"
        @click="toggle(file.path)"
      >
        <UIcon
          :name="expanded === file.path ? 'i-hugeicons-arrow-down-01' : 'i-hugeicons-arrow-right-01'"
          class="size-4 shrink-0 text-muted"
        />

        <span class="min-w-0 flex-1 truncate font-mono text-xs text-highlighted">{{ file.path }}</span>

        <span v-if="file.tally" class="shrink-0 font-mono text-xs">
          <span class="text-green-600 dark:text-green-400">+{{ file.tally.added }}</span>
          <span class="ml-1 text-red-600 dark:text-red-400">−{{ file.tally.removed }}</span>
        </span>

        <UBadge :label="file.change" :color="COLORS[file.change]" variant="soft" size="sm" class="shrink-0" />
      </button>

      <div v-if="expanded === file.path" class="border-t border-default">
        <div v-if="file.media" class="flex items-center gap-3 p-3">
          <div class="size-20 shrink-0 overflow-hidden rounded-sm ring ring-default">
            <MediaPreview
              :url="file.media.preview ?? file.media.url"
              :kind="mediaKind(file.media.name) ?? 'image'"
              :alt="file.media.name"
            />
          </div>

          <div class="min-w-0 text-sm">
            <p class="truncate font-medium text-highlighted">
              {{ file.media.name }}
            </p>
            <p class="text-muted">
              {{ file.media.type }}
            </p>
          </div>
        </div>

        <pre v-else class="max-h-72 overflow-auto bg-elevated/30 p-3 font-mono text-xs leading-relaxed"><code><span
          v-for="(line, index) in file.lines"
          :key="index"
          class="block whitespace-pre"
          :class="{
            'bg-green-500/10 text-green-700 dark:text-green-300': line.kind === 'add',
            'bg-red-500/10 text-red-700 dark:text-red-300': line.kind === 'remove',
            'text-muted': line.kind === 'keep',
          }"
        >{{ sign(line.kind) }}{{ line.text }}</span></code></pre>
      </div>
    </div>
  </div>
</template>
