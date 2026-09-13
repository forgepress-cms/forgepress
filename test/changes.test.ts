import type { Changes } from '../src/changes/types'
import type { BakedMedia, MediaAsset } from '../src/media/types'
import type { ContentSource, KeyValueStore } from '../src/store/types'
import type { ContentRow } from '../src/types/entry'
import type { ForgePressSchema } from '../src/types/schema'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { createChanges } from '../src/changes'
import { createMemoryStore } from '../src/editor/storage/memory'
import { defaultPaths } from '../src/files/paths'
import { toFiles } from '../src/forge'

const baseSchema = { collections: { hero: { fields: {} } }, locales: ['en'] } as ForgePressSchema
const nextSchema = { collections: { hero: { fields: {} }, author: { fields: {} } }, locales: ['en'] } as ForgePressSchema

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
  const rows = (collection: string): ContentRow[] => collection === 'hero' ? [row('a')] : []

  return {
    schema: async () => baseSchema,
    list: async collection => rows(collection),
    index: async collection => rows(collection),
    entry: async (collection, id) => rows(collection).find(item => item.id === id),
  }
}

function baked(assets: MediaAsset[]): BakedMedia {
  return { dir: 'public/uploads', url: '/uploads', maxSize: 1024, assets }
}

function make(store: KeyValueStore<Changes> = createMemoryStore<Changes>(), assets: MediaAsset[] = [banner]) {
  return { changes: createChanges(base(), async () => baked(assets), store), store, assets }
}

function file(name: string, bytes = 'hello', type = 'image/png'): File {
  return new File([bytes], name, { type })
}

describe('content view', () => {
  it('falls through to the base source while nothing is pending', async () => {
    const { changes } = make()

    expect(await changes.content.list('hero')).toEqual([row('a')])
    expect(await changes.content.schema()).toEqual(baseSchema)
  })

  it('overlays pending rows and a pending schema', async () => {
    const { changes } = make()

    await changes.content.writeContent('hero', [row('b')])
    await changes.content.writeSchema(nextSchema)

    expect(await changes.content.list('hero')).toEqual([row('b')])
    expect(await changes.content.schema()).toEqual(nextSchema)
  })

  it('reads a removed collection as empty', async () => {
    const { changes } = make()

    await changes.content.removeCollection('hero')

    expect(await changes.content.list('hero')).toEqual([])
  })

  it('stores cloneable data when handed a reactive array', async () => {
    const { changes, store } = make()

    await changes.content.writeContent('hero', reactive([row('b')]))

    const stored = (await store.read())!.entries.hero

    expect(() => structuredClone(stored)).not.toThrow()
  })
})

describe('media view', () => {
  it('shows pending uploads ahead of the baked listing', async () => {
    const { changes } = make()

    await changes.media.upload(file('photo.png'))

    expect(await changes.media.list()).toHaveLength(2)
  })

  it('hides a removed baked asset and tombstones it', async () => {
    const { changes, store } = make()

    await changes.media.remove(banner.name)

    expect(await changes.media.list()).toEqual([])
    expect((await store.read())!.removed).toEqual([banner.name])
  })

  it('rejects an unsupported type and an oversized file', async () => {
    const { changes } = make()

    await expect(changes.media.upload(file('notes.txt'))).rejects.toThrow('not a supported media file')
    await expect(changes.media.upload(file('big.png', 'x'.repeat(2000)))).rejects.toThrow('upload limit')
  })
})

describe('one record', () => {
  it('stores content and media changes together', async () => {
    const { changes, store } = make()

    await changes.content.writeContent('hero', [row('b')])
    await changes.media.upload(file('photo.png'))

    const stored = (await store.read())!

    expect(Object.keys(stored.entries)).toEqual(['hero'])
    expect(Object.keys(stored.uploads)).toHaveLength(1)
  })

  it('resumes both from the same store', async () => {
    const store = createMemoryStore<Changes>()

    await make(store).changes.content.writeContent('hero', [row('b')])
    await make(store).changes.media.upload(file('photo.png'))

    const resumed = make(store).changes

    expect(await resumed.content.list('hero')).toEqual([row('b')])
    expect(await resumed.media.list()).toHaveLength(2)
  })

  it('leaves nothing to publish once everything is published', async () => {
    const { changes } = make()

    await changes.content.writeSchema(nextSchema)
    await changes.content.writeContent('hero', [row('b')])
    await changes.media.upload(file('photo.png'))
    await changes.media.remove(banner.name)
    await changes.published()

    expect(toFiles(await changes.snapshot(), { paths: defaultPaths, mediaDir: 'public/uploads' })).toEqual([])
    expect(await changes.summary()).toEqual({ schema: false, written: [], discarded: [], dropped: [], uploaded: [], deleted: [] })
    expect(await changes.content.list('hero')).toEqual([row('a')])
    expect(await changes.content.schema()).toEqual(baseSchema)
  })

  it('keeps published media in view until the deployed site has it', async () => {
    const { changes, assets } = make()

    const photo = await changes.media.upload(file('photo.png'))

    await changes.media.remove(banner.name)
    await changes.published()

    expect((await changes.media.list()).map(asset => asset.name)).toEqual([photo.name])

    assets.splice(0, assets.length, { ...banner, name: photo.name, url: photo.url })

    expect(await changes.media.list()).toEqual([{ ...banner, name: photo.name, url: photo.url }])
  })

  it('forgets published media the deployed site has caught up with', async () => {
    const { changes, store, assets } = make()

    const photo = await changes.media.upload(file('photo.png'))

    await changes.media.remove(banner.name)
    await changes.published()

    expect((await store.read())?.publishedMedia).toEqual({ [photo.name]: expect.objectContaining({ name: photo.name }), [banner.name]: null })

    assets.splice(0, assets.length, { ...banner, name: photo.name, url: photo.url })

    await changes.content.writeContent('hero', [row('b')])
    await changes.published()

    expect(await store.read()).toBeUndefined()
  })

  it('lets published media be deleted again before the site has it', async () => {
    const { changes } = make()

    const photo = await changes.media.upload(file('photo.png'))

    await changes.published()
    await changes.media.remove(photo.name)

    expect((await changes.media.list()).map(asset => asset.name)).toEqual([banner.name])
    expect((await changes.summary()).deleted).toEqual([photo.name])
  })

  it('keeps published media when pending changes are discarded', async () => {
    const { changes } = make()

    const photo = await changes.media.upload(file('photo.png'))

    await changes.published()
    await changes.content.writeContent('hero', [row('b')])
    await changes.discard()

    expect(await changes.content.list('hero')).toEqual([row('a')])
    expect((await changes.media.list()).map(asset => asset.name)).toEqual([photo.name, banner.name])
  })

  it('discards everything at once', async () => {
    const { changes, store } = make()

    await changes.content.writeContent('hero', [row('b')])
    await changes.media.remove(banner.name)
    await changes.discard()

    expect(await changes.content.list('hero')).toEqual([row('a')])
    expect((await changes.media.list()).map(asset => asset.name)).toEqual([banner.name])
    expect(await store.read()).toBeUndefined()
  })
})

describe('summary', () => {
  it('separates every kind of pending change', async () => {
    const { changes } = make()

    await changes.content.writeSchema(nextSchema)
    await changes.content.writeContent('hero', [row('b')])
    await changes.content.removeCollection('author')
    await changes.media.upload(file('photo.png'))
    await changes.media.remove(banner.name)

    const summary = await changes.summary()

    expect(summary.schema).toBe(true)
    expect(summary.written).toEqual([{ collection: 'hero', id: 'b' }])
    expect(summary.discarded).toEqual([{ collection: 'hero', id: 'a' }])
    expect(summary.dropped).toEqual(['author'])
    expect(summary.uploaded).toHaveLength(1)
    expect(summary.deleted).toEqual([banner.name])
  })
})

describe('diff', () => {
  const target = { paths: defaultPaths, mediaDir: 'public/uploads' }

  it('reports nothing while there are no changes', async () => {
    expect(await make().changes.diff(target)).toEqual([])
  })

  it('diffs a changed entry against the baked content', async () => {
    const { changes } = make()

    await changes.content.writeContent('hero', [row('a', 'Goodbye')])

    const [entry] = await changes.diff(target)

    expect(entry?.path).toBe('.forgepress/content/hero/a.ts')
    expect(entry?.change).toBe('changed')
    expect(entry?.lines?.some(line => line.kind === 'remove' && line.text.includes('Hello'))).toBe(true)
    expect(entry?.lines?.some(line => line.kind === 'add' && line.text.includes('Goodbye'))).toBe(true)
  })

  it('marks an entry with no baked file as added', async () => {
    const { changes } = make()

    await changes.content.writeContent('author', [row('x')])

    const diff = await changes.diff(target)

    expect(diff.map(entry => [entry.path, entry.change])).toEqual([
      ['.forgepress/content/author/x.ts', 'added'],
    ])
  })

  it('marks a dropped collection as one removal per entry', async () => {
    const { changes } = make()

    await changes.content.removeCollection('hero')

    const [entry] = await changes.diff(target)

    expect(entry?.change).toBe('removed')
    expect(entry?.lines?.every(line => line.kind === 'remove')).toBe(true)
  })

  it('reports an upload as an added file carrying the asset', async () => {
    const { changes } = make()

    const asset = await changes.media.upload(file('photo.png'))
    const entry = (await changes.diff(target)).find(item => item.path.includes(asset.name))

    expect(entry?.change).toBe('added')
    expect(entry?.after?.name).toBe(asset.name)
  })

  it('reports a deleted asset with what it was', async () => {
    const { changes } = make()

    await changes.media.remove(banner.name)

    const [entry] = await changes.diff(target)

    expect(entry?.change).toBe('removed')
    expect(entry?.before?.name).toBe(banner.name)
  })

  it('touches only the entries that changed', async () => {
    const { changes } = make()

    await changes.content.writeEntry('hero', row('a', 'Goodbye'))

    expect((await changes.diff(target)).map(entry => entry.path)).toEqual(['.forgepress/content/hero/a.ts'])
  })

  it('prefixes diff paths with the repo base', async () => {
    const { changes } = make()

    await changes.content.writeContent('hero', [row('b')])

    expect((await changes.diff({ ...target, base: 'apps/site' })).map(entry => entry.path)).toEqual([
      'apps/site/.forgepress/content/hero/a.ts',
      'apps/site/.forgepress/content/hero/b.ts',
    ])
  })
})
