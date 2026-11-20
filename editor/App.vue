<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Header, PageView, PreviewDivider, PreviewPanel, SignIn } from './components'
import { useContent, usePreviewPane, useSession } from './composables'

defineProps<{
  container: HTMLElement
}>()

const content = useContent()
const { identity, restore } = useSession()
const preview = usePreviewPane()

const ready = ref(false)
const deployed = ref(false)

onMounted(async () => {
  try {
    if (await content.mode() === 'static') {
      deployed.value = true
      await restore()
    }
  }
  finally {
    ready.value = true
  }
})

const locked = computed(() => ready.value && deployed.value && identity.value === undefined)
const previewable = computed(() => ready.value && !locked.value && preview?.available.value === true)
const docked = computed(() => previewable.value && preview!.wide.value && preview!.open.value)
const sliding = computed(() => previewable.value && !preview!.wide.value)
const width = computed(() => `${(preview?.ratio.value ?? 0) * 100}%`)
const resizing = computed(() => preview?.resizing.value === true)
</script>

<template>
  <UApp :portal="container">
    <div class="fixed inset-0 flex bg-desk text-default" :class="resizing && 'cursor-col-resize select-none'">
      <div class="@container min-w-0 flex-1 overflow-y-auto">
        <div v-if="!ready" class="flex min-h-dvh items-center justify-center">
          <UIcon name="i-hugeicons-loading-03" class="size-6 animate-spin text-muted" />
        </div>

        <SignIn v-else-if="locked" />

        <template v-else>
          <Header :deployed="deployed" />

          <main class="pt-8 pb-16 sm:pt-12 sm:pb-20">
            <UContainer>
              <PageView />
            </UContainer>
          </main>
        </template>
      </div>

      <template v-if="docked && preview">
        <PreviewDivider />

        <PreviewPanel class="max-w-[calc(100%-30rem)] min-w-80 shrink-0" :style="{ width }" />
      </template>
    </div>

    <USlideover
      v-if="sliding && preview"
      v-model:open="preview.overlay.value"
      side="right"
      title="Preview"
      description="The site with the changes made in the editor"
      :ui="{ content: 'w-full max-w-none sm:max-w-2xl' }"
    >
      <template #content>
        <PreviewPanel />
      </template>
    </USlideover>
  </UApp>
</template>
