// @vitest-environment happy-dom
import type { App } from 'vue'
import type { ChangeService } from '../../../src/changes/types'
import type { Forge } from '../../../src/forge/types'
import type { ContentSource } from '../../../src/store/types'
import type { Entry } from '../../../src/types/entry'
import type { ForgePressSchema } from '../../../src/types/schema'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, onMounted, ref } from 'vue'
import { createChanges } from '../../../src/changes'
import { createMemoryStore } from '../../../src/editor/storage/memory'
import { defaultPaths } from '../../../src/files/paths'
import { serializeEntry, serializeSchema } from '../../../src/files/serialize'

const media = { dir: 'public/uploads', url: '/uploads', maxSize: 1024, assets: [] }

let changes: ChangeService | undefined
let forge: Forge | undefined
const blobs = new Map<string, string>()
const pinned: string[] = []
const tracked: string[] = []

vi.doMock('../../../src/editor/settings', () => ({
  baked: async () => ({ local: false, media, provider: undefined, format: undefined, paths: defaultPaths }),
}))

vi.doMock('../../../src/editor/composables/useSession', () => ({
  useSession: () => ({ forge: () => forge, provider: ref(undefined) }),
}))

vi.doMock('../../../src/editor/composables/useBuild', () => ({
  useBuild: () => ({
    track: async (commit: string) => {
      tracked.push(commit)
    },
  }),
}))

vi.doMock('../../../src/editor/composables/useContent', () => ({
  useContent: () => ({
    changes: async () => changes,
    target: async () => ({ paths: defaultPaths, mediaDir: media.dir }),
    read: async (sha: string) => blobs.get(sha)!,
    pin: async (commit: string) => {
      pinned.push(commit)
    },
    published: async () => {},
  }),
}))

const { usePublish } = await import('../../../src/editor/composables/usePublish')

function row(id: string): Entry {
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

function site() {
  const schema: ForgePressSchema = {
    collections: {
      author: { fields: { name: { type: 'text' } } },
      blogPost: { fields: { author: { type: 'relation', collection: 'author', optional: true } } },
    },
  }
  const content: Record<string, Record<string, Entry>> = {
    author: { author_1: { ...row('author_1'), name: 'Alice' } },
    blogPost: { post_1: { ...row('post_1'), author: 'author_1' } },
  }
  const files = new Map<string, string>([[defaultPaths.schema, serializeSchema(schema)]])

  for (const [collection, rows] of Object.entries(content)) {
    for (const [id, entry] of Object.entries(rows))
      files.set(defaultPaths.entry(collection, id), serializeEntry(collection, entry))
  }

  const listing = new Map([...files.keys()].map(path => [path, `sha:${path}`]))
  const commits: string[] = []

  for (const [path, text] of files)
    blobs.set(`sha:${path}`, text)

  forge = {
    access: async () => {
      throw new Error('not used')
    },
    head: async () => 'c1',
    files: async () => [...listing].map(([path, sha]) => ({ path, sha })),
    read: async () => {
      throw new Error('reads go through the editor content')
    },
    commit: async (changed) => {
      commits.push(changed.map(file => file.path).join(' '))

      return 'c2'
    },
    checks: async () => [],
    contains: async () => false,
  }

  changes = createChanges({
    schema: async () => schema,
    list: async collection => Object.values(content[collection] ?? {}),
    entry: async (collection, id) => content[collection]?.[id],
  }, async () => media, createMemoryStore(), {
    entry: async (collection, id) => listing.get(defaultPaths.entry(collection, id)),
  })

  return { changes, commits }
}

let app: App | undefined

afterEach(() => {
  app?.unmount()
  pinned.length = 0
  tracked.length = 0
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

describe('publishing', () => {
  it('commits nothing while the result would not build, and lists the problems by file', async () => {
    const { changes, commits } = site()
    const publisher = usePublish()

    await changes.content.removeEntry('author', 'author_1')

    expect(await publisher.publish('remove alice')).toBeUndefined()
    expect(commits).toEqual([])
    expect(pinned).toEqual(['c1'])
    expect(tracked).toEqual([])
    expect(publisher.error.value).toBe('')
    expect(publisher.issues.value).toEqual([{
      path: '.forgepress/content/blog-post/post_1.ts',
      entry: { collection: 'blogPost', id: 'post_1' },
      messages: ['Field "author" references author/author_1, which doesn\'t exist'],
    }])
  })

  it('publishes once the references are gone too', async () => {
    const { changes, commits } = site()
    const publisher = usePublish()

    await changes.content.removeEntry('author', 'author_1')
    await publisher.publish('remove alice')
    await changes.content.writeEntry('blogPost', row('post_1'))

    expect(await publisher.publish('remove alice')).toBe('c2')
    expect(commits).toEqual(['.forgepress/content/author/author_1.ts .forgepress/content/blog-post/post_1.ts'])
    expect(publisher.issues.value).toEqual([])
    expect(tracked).toEqual(['c2'])
  })
})
