// @vitest-environment happy-dom
import type { App } from 'vue'
import type { CollectionEntry } from '../../../src/entries/references'
import type { PreviewContext, PreviewPane } from '../../plugins/preview'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'
import { previewKey } from '../../plugins/preview'
import { usePreviewContext, usePreviewDraft } from './usePreviewPane'

const context: PreviewContext = { schema: { collections: { page: { fields: { title: { type: 'text' } } } } }, collection: 'page' }
const entry = { id: 'page_1', status: 'published' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }

const title = ref('Home')
const events: unknown[] = []

let app: App | undefined

function mount(available: boolean): void {
  const pane = {
    available,
    show: (next: PreviewContext) => {
      events.push(['show', next.collection])

      return () => void events.push(['hide', next.collection])
    },
    draft: (entries: readonly CollectionEntry[]) => void events.push(['draft', entries.map(item => item.entry.title)]),
  }

  app = createApp(defineComponent({
    setup() {
      usePreviewContext(context)
      usePreviewDraft(() => [{ collection: 'page', entry: { ...entry, title: title.value } }])

      return () => h('div')
    },
  }))

  app.provide(previewKey, pane as unknown as PreviewPane)
  app.mount(document.createElement('div'))
}

beforeEach(() => {
  vi.useFakeTimers()
  title.value = 'Home'
  events.length = 0
})

afterEach(() => {
  app?.unmount()
  app = undefined
  vi.useRealTimers()
})

describe('usePreviewContext and usePreviewDraft', () => {
  it('sends the draft once typing pauses and clears it when the page is left', async () => {
    mount(true)

    title.value = 'Hom'
    await vi.advanceTimersByTimeAsync(50)
    title.value = 'Homepage'
    await vi.advanceTimersByTimeAsync(200)

    expect(events).toEqual([['show', 'page'], ['draft', ['Homepage']]])

    app?.unmount()
    app = undefined

    expect(events.slice(2)).toEqual([['hide', 'page'], ['draft', []]])
  })

  it('does nothing when the editor has no preview', async () => {
    mount(false)

    title.value = 'Homepage'
    await vi.advanceTimersByTimeAsync(200)

    expect(events).toEqual([])
  })
})
