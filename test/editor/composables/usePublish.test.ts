// @vitest-environment happy-dom
import type { App } from 'vue'
import type { ChangeService } from '../../../src/changes/types'
import type { ContentSource } from '../../../src/store/types'
import type { ContentRow } from '../../../src/types/entry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, onMounted } from 'vue'
import { createChanges } from '../../../src/changes'
import { createMemoryStore } from '../../../src/editor/storage/memory'
import { defaultPaths } from '../../../src/files/paths'

const media = { dir: 'public/uploads', url: '/uploads', maxSize: 1024, assets: [] }

let changes: ChangeService | undefined

vi.doMock('../../../src/store/bundle', () => ({
  baked: async () => ({ local: false, media, provider: undefined, format: undefined, paths: defaultPaths }),
}))

vi.doMock('../../../src/editor/composables/useContent', () => ({
  useContent: () => ({
    changes: async () => changes,
    target: async () => ({ paths: defaultPaths, mediaDir: media.dir }),
  }),
}))

const { usePublish } = await import('../../../src/editor/composables/usePublish')

function row(id: string): ContentRow {
  return { id, status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
}

const base: ContentSource = {
  schema: async () => ({ collections: { hero: { fields: {} } } }),
  list: async () => [],
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
    const service = createChanges(base, async () => media, createMemoryStore())
    const container = document.createElement('div')

    changes = service

    const Header = defineComponent({
      setup: () => {
        const { count, refresh } = usePublish()

        onMounted(refresh)

        return () => h('span', String(count.value))
      },
    })

    app = createApp(Header)
    app.mount(container)

    await settle()
    expect(container.textContent).toBe('0')

    await service.content.writeEntry('hero', row('hero_1'))
    await settle()
    expect(container.textContent).toBe('1')

    await service.content.writeEntry('hero', row('hero_2'))
    await settle()
    expect(container.textContent).toBe('2')

    await service.published()
    await settle()
    expect(container.textContent).toBe('0')
  })
})
