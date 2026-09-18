// @vitest-environment happy-dom
import type { App } from 'vue'
import type { ChangeService } from '../../../src/changes/types'
import type { Entry } from '../../../src/entries/types'
import type { Forge } from '../../../src/forge/types'
import type { ForgePressSchema } from '../../../src/schema/types'
import type { ContentSource } from '../../../src/store/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, onMounted, ref } from 'vue'
import { createChanges } from '../../../src/changes'
import { defaultPaths } from '../../../src/files/paths'
import { serializeEntry, serializeSchema } from '../../../src/files/serialize'
import { createMemoryStore } from '../../../src/store/memory'
import { settle } from '../../settle'

const media = { dir: 'public/uploads', url: '/uploads', maxSize: 1024 }
const uploads = { settings: async () => media, stored: async () => [], served: async () => false }

let changes: ChangeService | undefined
let forge: Forge | undefined
const blobs = new Map<string, string>()
const pinned: string[] = []
const tracked: string[] = []

vi.doMock('../../../editor/settings', () => ({
  baked: async () => ({ local: false, media, provider: undefined, format: undefined, paths: defaultPaths }),
}))

vi.doMock('../../../editor/composables/useSession', () => ({
  useSession: () => ({ forge: () => forge, provider: ref(undefined) }),
}))

vi.doMock('../../../editor/composables/useBuild', () => ({
  useBuild: () => ({
    track: async (commit: string) => {
      tracked.push(commit)
    },
  }),
}))

vi.doMock('../../../editor/composables/useContent', () => ({
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

const { usePublish } = await import('../../../editor/composables/usePublish')

function row(id: string): Entry {
  return { id, status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }
}

const base: ContentSource = {
  schema: async () => ({ collections: { hero: { fields: {} } } }),
  list: async () => [],
  entry: async () => undefined,
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
  const committed = new Map<string, string>()

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

      for (const file of changed) {
        if ('data' in file)
          committed.set(file.path, file.data)
      }

      return 'c2'
    },
    checks: async () => [],
    contains: async () => false,
  }

  changes = createChanges({
    schema: async () => schema,
    list: async collection => Object.values(content[collection] ?? {}),
    entry: async (collection, id) => content[collection]?.[id],
  }, uploads, createMemoryStore(), {
    entry: async (collection, id) => listing.get(defaultPaths.entry(collection, id)),
  })

  function upstream(next: ForgePressSchema, collection: string, entry: Entry): void {
    const entryPath = defaultPaths.entry(collection, entry.id)

    Object.assign(schema, next)
    content[collection]![entry.id] = entry

    for (const [path, text] of [[defaultPaths.schema, serializeSchema(next)], [entryPath, serializeEntry(collection, entry)]] as const) {
      listing.set(path, `sha2:${path}`)
      blobs.set(`sha2:${path}`, text)
    }
  }

  return { changes, commits, committed, upstream }
}

let app: App | undefined

afterEach(() => {
  app?.unmount()
  pinned.length = 0
  tracked.length = 0
})

describe('publish count', () => {
  it('follows changes saved anywhere in the editor', async () => {
    const service = createChanges(base, uploads, createMemoryStore())
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

  it('merges edits made before a schema change instead of reporting conflicts', async () => {
    const { changes, commits, committed, upstream } = site()
    const publisher = usePublish()

    await changes.content.writeEntry('author', { ...row('author_1'), name: 'Alice Liddell', colour: 'red' })

    upstream({
      collections: {
        author: { fields: { fullName: { type: 'text' } } },
        blogPost: { fields: { author: { type: 'relation', collection: 'author', optional: true } } },
      },
    }, 'author', { ...row('author_1'), fullName: 'Alice' })

    expect(await publisher.publish('rename')).toBe('c2')
    expect(publisher.conflicts.value).toEqual([])
    expect(commits).toEqual(['.forgepress/content/author/author_1.ts'])
    expect(committed.get('.forgepress/content/author/author_1.ts')).toContain('fullName: \'Alice Liddell\',')
    expect(committed.get('.forgepress/content/author/author_1.ts')).not.toContain('name:')
  })

  it('still reports a field both sides changed', async () => {
    const { changes, commits, upstream } = site()
    const publisher = usePublish()

    await changes.content.writeEntry('author', { ...row('author_1'), name: 'Alice Liddell' })

    upstream({
      collections: {
        author: { fields: { name: { type: 'text' } } },
        blogPost: { fields: { author: { type: 'relation', collection: 'author', optional: true } } },
      },
    }, 'author', { ...row('author_1'), name: 'Alice Pleasance' })

    expect(await publisher.publish('rename')).toBeUndefined()
    expect(publisher.conflicts.value).toEqual([{ path: '.forgepress/content/author/author_1.ts', hash: 'sha2:.forgepress/content/author/author_1.ts' }])
    expect(commits).toEqual([])
  })
})
