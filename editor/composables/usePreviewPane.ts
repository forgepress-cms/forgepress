import type { CollectionEntry } from '../../src/entries/references'
import type { PreviewContext, PreviewPane } from '../plugins/preview'
import { debounce } from 'perfect-debounce'
import { inject, onBeforeUnmount, watch } from 'vue'
import { previewKey } from '../plugins/preview'

const DRAFT_DELAY = 150

export function usePreviewPane(): PreviewPane | undefined {
  return inject(previewKey, undefined)
}

export function usePreviewContext(context: PreviewContext): void {
  const pane = usePreviewPane()

  if (!pane?.available)
    return

  onBeforeUnmount(pane.show(context))
}

export function usePreviewDraft(entries: () => readonly CollectionEntry[]): void {
  const pane = usePreviewPane()

  if (!pane?.available)
    return

  let stopped = false

  const send = debounce(async () => {
    if (!stopped)
      pane.draft(entries())
  }, DRAFT_DELAY)

  watch(() => JSON.stringify(entries()), () => void send())

  onBeforeUnmount(() => {
    stopped = true
    send.cancel()
    pane.draft([])
  })
}
