<script setup lang="ts">
import { computed } from 'vue'
import { usePreviewPane } from '../../composables'
import { DEFAULT_RATIO } from '../../plugins'

const pane = usePreviewPane()!
const { ratio, resizing } = pane

const STEP = 0.02
const KEYS: Record<string, number> = { ArrowLeft: STEP, ArrowRight: -STEP, PageUp: STEP * 5, PageDown: -STEP * 5, Home: 1, End: -1 }

const percent = computed(() => Math.round(ratio.value * 100))

function ratioAt(handle: HTMLElement, x: number): number {
  const box = handle.parentElement!.getBoundingClientRect()

  return (box.right - x) / box.width
}

function start(event: PointerEvent): void {
  if (event.button !== 0)
    return

  const handle = event.currentTarget as HTMLElement

  event.preventDefault()
  handle.setPointerCapture(event.pointerId)
  resizing.value = true

  const move = (next: PointerEvent): void => {
    pane.resize(ratioAt(handle, next.clientX))
  }

  const end = (): void => {
    resizing.value = false
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', end)
    handle.removeEventListener('pointercancel', end)
  }

  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}

function press(event: KeyboardEvent): void {
  const step = KEYS[event.key]

  if (step === undefined)
    return

  event.preventDefault()
  pane.resize(ratio.value + step)
}
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Width of the preview"
    aria-valuemin="20"
    aria-valuemax="80"
    :aria-valuenow="percent"
    tabindex="0"
    class="group relative z-10 w-px shrink-0 cursor-col-resize touch-none bg-(--ui-border) outline-none select-none"
    @pointerdown="start"
    @keydown="press"
    @dblclick="pane.resize(DEFAULT_RATIO)"
  >
    <span class="absolute inset-y-0 -inset-x-2" />

    <span
      class="absolute top-1/2 left-1/2 h-10 w-1.5 -translate-1/2 rounded-full transition-colors group-hover:bg-primary group-focus-visible:bg-primary"
      :class="resizing ? 'bg-primary' : 'bg-accented'"
    />
  </div>
</template>
