// @vitest-environment happy-dom
import type { App } from 'vue'
import type { EditorContent } from '../src/editor/plugins/content'
import type { ContentSource } from '../src/store/types'
import type { ContentRow } from '../src/types/entry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, onMounted } from 'vue'
import { createChanges } from '../src/changes'
import { createMemoryStore } from '../src/editor/storage/memory'
import { defaultPaths } from '../src/files/paths'

const media = { dir: 'public/uploads', url: '/uploads', maxSize: 1024, assets: [] }

vi.doMock('../src/store/bundle', () => ({
  baked: async () => ({ local: false, media, provider: undefined, format: undefined, paths: defaultPaths }),
}))

const { contentKey } = await import('../src/editor/plugins/content')
const { usePublish } = await import('../src/editor/composables/usePublish')

function row(id: string): ContentRow {
  return { id, status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
}

const base: ContentSource = {
  schema: async () => ({ collections: { hero: { fields: {} } } }),
  list: async () => [],
  index: async () => [],
  entry: async () => undefined,
}

function settle(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

let app: App | undefined

afterEach(() => {
  app?.unmount()
})

describe('publish count', () => {
  it('follows changes saved anywhere in the editor', async () => {
    const changes = createChanges(base, async () => media, createMemoryStore())
    const container = document.createElement('div')

    const Header = defineComponent({
      setup: () => {
        const { count, refresh } = usePublish()

        onMounted(refresh)

        return () => h('span', String(count.value))
      },
    })

    app = createApp(Header)
    app.provide(contentKey, { changes: async () => changes } as unknown as EditorContent)
    app.mount(container)

    await settle()
    expect(container.textContent).toBe('0')

    await changes.content.writeEntry('hero', row('hero_1'))
    await settle()
    expect(container.textContent).toBe('1')

    await changes.content.writeEntry('hero', row('hero_2'))
    await settle()
    expect(container.textContent).toBe('2')

    await changes.published()
    await settle()
    expect(container.textContent).toBe('0')
  })
})
