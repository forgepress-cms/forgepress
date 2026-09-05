import type { Draft } from '../src/types/content/draft'
import type { BakedMedia } from '../src/types/content/media'
import type { ContentRow, ContentSource } from '../src/types/content/reader'
import type { KeyValueStore } from '../src/types/content/store'
import type { WebenvSchema } from '../src/types/core/schema'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { createDraft } from '../src/content/draft'
import { createMemoryStore } from '../src/content/storage/memory'

const baseSchema = { components: { hero: { elements: {} } }, locales: ['en'] } as WebenvSchema
const nextSchema = { components: { hero: { elements: {} }, author: { elements: {} } }, locales: ['en'] } as WebenvSchema

const banner = {
  name: 'banner.abc12345.png',
  url: '/uploads/banner.abc12345.png',
  type: 'image/png',
  size: 12,
  modifiedAt: '2026-01-01T00:00:00.000Z',
}

function row(id: string, title = 'Hello'): ContentRow {
  return { id, status: 'published', createdAt: '', updatedAt: '', title }
}

function base(): ContentSource {
  return {
    schema: async () => baseSchema,
    list: async component => component === 'hero' ? [row('a')] : [],
  }
}

function baked(): BakedMedia {
  return { dir: 'public/uploads', url: '/uploads', maxSize: 1024, assets: [banner] }
}

function make(store: KeyValueStore<Draft> = createMemoryStore<Draft>()) {
  return { draft: createDraft(base(), async () => baked(), store), store }
}

function file(name: string, bytes = 'hello', type = 'image/png'): File {
  return new File([bytes], name, { type })
}

describe('content view', () => {
  it('falls through to the base source while nothing is pending', async () => {
    const { draft } = make()

    expect(await draft.content.list('hero')).toEqual([row('a')])
    expect(await draft.content.schema()).toEqual(baseSchema)
  })

  it('overlays pending rows and a pending schema', async () => {
    const { draft } = make()

    await draft.content.writeContent('hero', [row('b')])
    await draft.content.writeSchema(nextSchema)

    expect(await draft.content.list('hero')).toEqual([row('b')])
    expect(await draft.content.schema()).toEqual(nextSchema)
  })

  it('reads a removed component as empty', async () => {
    const { draft } = make()

    await draft.content.removeContent('hero')

    expect(await draft.content.list('hero')).toEqual([])
  })

  it('stores cloneable data when handed a reactive array', async () => {
    const { draft, store } = make()

    await draft.content.writeContent('hero', reactive([row('b')]))

    const stored = (await store.read())!.components.hero

    expect(() => structuredClone(stored)).not.toThrow()
  })
})

describe('media view', () => {
  it('shows pending uploads ahead of the baked listing', async () => {
    const { draft } = make()

    await draft.media.upload(file('photo.png'))

    expect(await draft.media.list()).toHaveLength(2)
  })

  it('hides a removed baked asset and tombstones it', async () => {
    const { draft, store } = make()

    await draft.media.remove(banner.name)

    expect(await draft.media.list()).toEqual([])
    expect((await store.read())!.removed).toEqual([banner.name])
  })

  it('rejects an unsupported type and an oversized file', async () => {
    const { draft } = make()

    await expect(draft.media.upload(file('notes.txt'))).rejects.toThrow('not a supported media file')
    await expect(draft.media.upload(file('big.png', 'x'.repeat(2000)))).rejects.toThrow('upload limit')
  })
})

describe('one record', () => {
  it('keeps content and media in the same stored draft', async () => {
    const { draft, store } = make()

    await draft.content.writeContent('hero', [row('b')])
    await draft.media.upload(file('photo.png'))

    const stored = (await store.read())!

    expect(Object.keys(stored.components)).toEqual(['hero'])
    expect(Object.keys(stored.uploads)).toHaveLength(1)
  })

  it('resumes both from the same store', async () => {
    const store = createMemoryStore<Draft>()

    await make(store).draft.content.writeContent('hero', [row('b')])
    await make(store).draft.media.upload(file('photo.png'))

    const resumed = make(store).draft

    expect(await resumed.content.list('hero')).toEqual([row('b')])
    expect(await resumed.media.list()).toHaveLength(2)
  })

  it('records one published commit for the whole draft', async () => {
    const { draft } = make()

    await draft.content.writeContent('hero', [row('b')])
    await draft.media.upload(file('photo.png'))
    await draft.published('abc1234')

    expect((await draft.summary()).published).toBe('abc1234')
  })

  it('clears the published marker on any further edit', async () => {
    const { draft } = make()

    await draft.content.writeContent('hero', [row('b')])
    await draft.published('abc1234')
    await draft.media.upload(file('photo.png'))

    expect((await draft.summary()).published).toBeUndefined()
  })

  it('discards everything at once', async () => {
    const { draft, store } = make()

    await draft.content.writeContent('hero', [row('b')])
    await draft.media.remove(banner.name)
    await draft.discard()

    expect(await draft.content.list('hero')).toEqual([row('a')])
    expect((await draft.media.list()).map(asset => asset.name)).toEqual([banner.name])
    expect(await store.read()).toBeUndefined()
  })
})

describe('summary', () => {
  it('separates every kind of pending change', async () => {
    const { draft } = make()

    await draft.content.writeSchema(nextSchema)
    await draft.content.writeContent('hero', [row('b')])
    await draft.content.removeContent('author')
    await draft.media.upload(file('photo.png'))
    await draft.media.remove(banner.name)

    const summary = await draft.summary()

    expect(summary.schema).toBe(true)
    expect(summary.written).toEqual(['hero'])
    expect(summary.dropped).toEqual(['author'])
    expect(summary.uploaded).toHaveLength(1)
    expect(summary.deleted).toEqual([banner.name])
  })
})

describe('diff', () => {
  const target = { mediaDir: 'public/uploads' }

  it('reports nothing while the draft is clean', async () => {
    expect(await make().draft.diff(target)).toEqual([])
  })

  it('diffs a changed component against the baked content', async () => {
    const { draft } = make()

    await draft.content.writeContent('hero', [row('a', 'Goodbye')])

    const [entry] = await draft.diff(target)

    expect(entry?.path).toBe('.webenv/content/hero.ts')
    expect(entry?.change).toBe('changed')
    expect(entry?.lines?.some(line => line.kind === 'remove' && line.text.includes('Hello'))).toBe(true)
    expect(entry?.lines?.some(line => line.kind === 'add' && line.text.includes('Goodbye'))).toBe(true)
  })

  it('marks a component with no baked file as added', async () => {
    const { draft } = make()

    await draft.content.writeContent('author', [row('x')])

    expect((await draft.diff(target))[0]?.change).toBe('added')
  })

  it('marks a dropped component as removed with only removals', async () => {
    const { draft } = make()

    await draft.content.removeContent('hero')

    const [entry] = await draft.diff(target)

    expect(entry?.change).toBe('removed')
    expect(entry?.lines?.every(line => line.kind === 'remove')).toBe(true)
  })

  it('reports an upload as an added file carrying the asset', async () => {
    const { draft } = make()

    const asset = await draft.media.upload(file('photo.png'))
    const entry = (await draft.diff(target)).find(item => item.path.includes(asset.name))

    expect(entry?.change).toBe('added')
    expect(entry?.after?.name).toBe(asset.name)
  })

  it('reports a deleted asset with what it was', async () => {
    const { draft } = make()

    await draft.media.remove(banner.name)

    const [entry] = await draft.diff(target)

    expect(entry?.change).toBe('removed')
    expect(entry?.before?.name).toBe(banner.name)
  })

  it('prefixes diff paths with the repo base', async () => {
    const { draft } = make()

    await draft.content.writeContent('hero', [row('b')])

    const [entry] = await draft.diff({ ...target, base: 'apps/site' })

    expect(entry?.path).toBe('apps/site/.webenv/content/hero.ts')
  })
})
