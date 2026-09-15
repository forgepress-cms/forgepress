import type { Changes } from '../../src/changes/types'
import type { HashSource } from '../../src/forge/types'
import type { MediaSource } from '../../src/media/types'
import type { ContentSource, KeyValueStore } from '../../src/store/types'
import type { Entry } from '../../src/types/entry'
import type { ForgePressSchema } from '../../src/types/schema'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { createChanges } from '../../src/changes'
import { defaultPaths } from '../../src/files/paths'
import { createMemoryStore } from '../../src/storage/memory'

const baseSchema = { collections: { hero: { fields: {} } }, locales: ['en'] } as ForgePressSchema

const target = { paths: defaultPaths, mediaDir: 'public/uploads' }

const banner = 'banner.abc12345.png'

function row(id: string, title = 'Hello'): Entry {
  return { id, status: 'published', createdAt: '', updatedAt: '', title }
}

function base(): ContentSource {
  const rows = (collection: string): Entry[] => collection === 'hero' ? [row('a')] : []

  return {
    schema: async () => baseSchema,
    list: async collection => rows(collection),
    entry: async (collection, id) => rows(collection).find(item => item.id === id),
  }
}

function library(names: string[] = [banner]) {
  const stored = [...names]
  const served = new Set<string>()
  const probed: string[] = []

  const source: MediaSource = {
    settings: async () => ({ dir: 'public/uploads', url: '/uploads', maxSize: 1024 }),
    stored: async () => [...stored],
    served: async (url) => {
      probed.push(url)

      return served.has(url)
    },
  }

  return { stored, served, probed, source }
}

function make(store: KeyValueStore<Changes> = createMemoryStore<Changes>(), media = library()) {
  return { changes: createChanges(base(), media.source, store), store, media }
}

function tracked(store: KeyValueStore<Changes> = createMemoryStore<Changes>()) {
  const hashes = new Map([['hero/a', 'h-a']])
  const source: HashSource = { entry: async (collection, id) => hashes.get(`${collection}/${id}`) }

  return { changes: createChanges(base(), library().source, store, source), store, hashes }
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

  it('overlays pending rows', async () => {
    const { changes } = make()

    await changes.content.writeEntry('hero', row('b'))
    await changes.content.removeEntry('hero', 'a')

    expect(await changes.content.list('hero')).toEqual([row('b')])
  })

  it('reads a removed entry as gone', async () => {
    const { changes } = make()

    await changes.content.removeEntry('hero', 'a')

    expect(await changes.content.entry('hero', 'a')).toBeUndefined()
    expect(await changes.content.list('hero')).toEqual([])
  })

  it('stores cloneable data when handed a reactive entry', async () => {
    const { changes, store } = make()

    await changes.content.writeEntry('hero', reactive(row('b')))

    const stored = (await store.read())!.entries.hero

    expect(() => structuredClone(stored)).not.toThrow()
  })
})

describe('media view', () => {
  it('shows pending uploads ahead of the files in the repository', async () => {
    const { changes } = make()

    const photo = await changes.media.upload(file('photo.png'))

    expect(await changes.media.list()).toEqual([
      expect.objectContaining({ name: photo.name, url: `/uploads/${photo.name}`, type: 'image/png', size: 5, preview: expect.stringMatching(/^blob:/) }),
      { name: banner, url: `/uploads/${banner}`, type: 'image/png' },
    ])
  })

  it('hides a removed file of the repository and remembers the deletion', async () => {
    const { changes, store } = make()

    await changes.media.remove(banner)

    expect(await changes.media.list()).toEqual([])
    expect((await store.read())!.removed).toEqual([banner])
  })

  it('rejects an unsupported type and an oversized file', async () => {
    const { changes } = make()

    await expect(changes.media.upload(file('notes.txt'))).rejects.toThrow('not a supported media file')
    await expect(changes.media.upload(file('big.png', 'x'.repeat(2000)))).rejects.toThrow('upload limit')
  })

  it('doesn\'t upload a file again that the repository already has', async () => {
    const { name } = await make(undefined, library([])).changes.media.upload(file('photo.png'))
    const { changes } = make(undefined, library([name]))

    expect(await changes.media.upload(file('photo.png'))).toEqual({ name, url: `/uploads/${name}`, type: 'image/png' })
    expect((await changes.summary()).uploaded).toEqual([])

    await changes.media.remove(name)

    expect((await changes.summary()).deleted).toEqual([name])

    await changes.media.upload(file('photo.png'))

    expect(await changes.summary()).toEqual({ written: [], discarded: [], uploaded: [], deleted: [] })
  })
})

describe('one record', () => {
  it('stores content and media changes together', async () => {
    const { changes, store } = make()

    await changes.content.writeEntry('hero', row('b'))
    await changes.media.upload(file('photo.png'))

    const stored = (await store.read())!

    expect(Object.keys(stored.entries)).toEqual(['hero'])
    expect(Object.keys(stored.uploads)).toHaveLength(1)
  })

  it('resumes both from the same store', async () => {
    const store = createMemoryStore<Changes>()

    await make(store).changes.content.writeEntry('hero', row('b'))
    await make(store).changes.media.upload(file('photo.png'))

    const resumed = make(store).changes

    expect(await resumed.content.list('hero')).toEqual([row('a'), row('b')])
    expect(await resumed.media.list()).toHaveLength(2)
  })

  it('leaves nothing to publish once everything is published', async () => {
    const { changes } = make()

    await changes.content.writeEntry('hero', row('b'))
    await changes.media.upload(file('photo.png'))
    await changes.media.remove(banner)
    await changes.published()

    expect(await changes.files(target)).toEqual([])
    expect(await changes.summary()).toEqual({ written: [], discarded: [], uploaded: [], deleted: [] })
    expect(await changes.content.list('hero')).toEqual([row('a')])
  })

  it('previews published uploads from the browser until the site serves them', async () => {
    const { changes, store, media } = make()

    const photo = await changes.media.upload(file('photo.png'))

    await changes.media.remove(banner)
    await changes.published()

    media.stored.splice(0, media.stored.length, photo.name)

    expect((await changes.media.list()).map(asset => [asset.name, asset.preview?.startsWith('blob:')])).toEqual([[photo.name, true]])
    expect(media.probed).toEqual([`/uploads/${photo.name}`])
    expect((await store.read())?.publishedMedia).toEqual({ [photo.name]: expect.objectContaining({ name: photo.name }) })

    media.served.add(`/uploads/${photo.name}`)

    expect(await changes.media.list()).toEqual([{ name: photo.name, url: `/uploads/${photo.name}`, type: 'image/png' }])
    expect((await store.read())?.publishedMedia).toBeUndefined()
  })

  it('lets published uploads be deleted again before the site serves them', async () => {
    const { changes, store, media } = make()

    const photo = await changes.media.upload(file('photo.png'))

    await changes.published()
    media.stored.push(photo.name)
    await changes.media.remove(photo.name)

    expect((await changes.media.list()).map(asset => asset.name)).toEqual([banner])
    expect((await changes.summary()).deleted).toEqual([photo.name])

    await changes.published()

    expect(await store.read()).toBeUndefined()
  })

  it('keeps published uploads when pending changes are discarded', async () => {
    const { changes, media } = make()

    const photo = await changes.media.upload(file('photo.png'))

    await changes.published()
    media.stored.push(photo.name)
    await changes.content.writeEntry('hero', row('b'))
    await changes.discard()

    expect(await changes.content.list('hero')).toEqual([row('a')])
    expect((await changes.media.list()).map(asset => asset.name)).toEqual([photo.name, banner])
  })

  it('discards everything at once', async () => {
    const { changes, store } = make()

    await changes.content.writeEntry('hero', row('b'))
    await changes.media.remove(banner)
    await changes.discard()

    expect(await changes.content.list('hero')).toEqual([row('a')])
    expect((await changes.media.list()).map(asset => asset.name)).toEqual([banner])
    expect(await store.read()).toBeUndefined()
  })
})

describe('summary', () => {
  it('separates every kind of pending change', async () => {
    const { changes } = make()

    await changes.content.writeEntry('hero', row('b'))
    await changes.content.removeEntry('hero', 'a')
    await changes.media.upload(file('photo.png'))
    await changes.media.remove(banner)

    const summary = await changes.summary()

    expect(summary.written).toEqual([{ collection: 'hero', id: 'b' }])
    expect(summary.discarded).toEqual([{ collection: 'hero', id: 'a' }])
    expect(summary.uploaded).toHaveLength(1)
    expect(summary.deleted).toEqual([banner])
  })

  it('tells subscribers about every change until they unsubscribe', async () => {
    const { changes } = make()
    const counts: number[] = []

    const unsubscribe = changes.subscribe(() => {
      void changes.summary().then(summary => counts.push(summary.written.length + summary.deleted.length + summary.uploaded.length))
    })

    await changes.content.writeEntry('hero', row('b'))
    await changes.media.remove(banner)
    await changes.media.upload(file('photo.png'))
    await changes.published()
    await changes.content.removeEntry('hero', 'b')
    await changes.discard()

    unsubscribe()

    await changes.content.writeEntry('hero', row('c'))

    expect(counts).toEqual([1, 2, 3, 0, 0, 0])
  })
})

describe('diff', () => {
  it('reports nothing while there are no changes', async () => {
    expect(await make().changes.diff(target)).toEqual([])
  })

  it('diffs a changed entry against the baked content', async () => {
    const { changes } = make()

    await changes.content.writeEntry('hero', row('a', 'Goodbye'))

    const [entry] = await changes.diff(target)

    expect(entry?.path).toBe('.forgepress/content/hero/a.ts')
    expect(entry?.change).toBe('changed')
    expect(entry?.lines?.some(line => line.kind === 'remove' && line.text.includes('Hello'))).toBe(true)
    expect(entry?.lines?.some(line => line.kind === 'add' && line.text.includes('Goodbye'))).toBe(true)
  })

  it('marks an entry with no baked file as added', async () => {
    const { changes } = make()

    await changes.content.writeEntry('author', row('x'))

    const diff = await changes.diff(target)

    expect(diff.map(entry => [entry.path, entry.change])).toEqual([
      ['.forgepress/content/author/x.ts', 'added'],
    ])
  })

  it('marks a removed entry as a removal of every line', async () => {
    const { changes } = make()

    await changes.content.removeEntry('hero', 'a')

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

    await changes.media.remove(banner)

    const [entry] = await changes.diff(target)

    expect(entry?.change).toBe('removed')
    expect(entry?.before?.name).toBe(banner)
  })

  it('shows a deleted upload the site doesn\'t serve yet from the browser', async () => {
    const { changes, media } = make()

    const photo = await changes.media.upload(file('photo.png'))

    await changes.published()
    media.stored.push(photo.name)
    await changes.media.remove(photo.name)

    const [entry] = await changes.diff(target)

    expect(entry?.change).toBe('removed')
    expect(entry?.before?.preview).toMatch(/^blob:/)
  })

  it('touches only the entries that changed', async () => {
    const { changes } = make()

    await changes.content.writeEntry('hero', row('a', 'Goodbye'))

    expect((await changes.diff(target)).map(entry => entry.path)).toEqual(['.forgepress/content/hero/a.ts'])
  })

  it('prefixes diff paths with the repo base', async () => {
    const { changes } = make()

    await changes.content.writeEntry('hero', row('b'))
    await changes.content.removeEntry('hero', 'a')

    expect((await changes.diff({ ...target, base: 'apps/site' })).map(entry => entry.path)).toEqual([
      'apps/site/.forgepress/content/hero/a.ts',
      'apps/site/.forgepress/content/hero/b.ts',
    ])
  })
})

describe('file hashes', () => {
  async function replaced(changes: ReturnType<typeof tracked>['changes']) {
    return (await changes.files(target)).map(item => [item.path, item.replaces])
  }

  it('remembers the hash of each file a change was made against', async () => {
    const { changes, store } = tracked()

    await changes.content.writeEntry('hero', row('a', 'Goodbye'))
    await changes.content.writeEntry('author', row('x'))

    expect((await store.read())?.hashes).toEqual({ entries: { hero: { a: 'h-a' }, author: { x: null } } })
    expect(await replaced(changes)).toEqual([
      ['.forgepress/content/hero/a.ts', 'h-a'],
      ['.forgepress/content/author/x.ts', null],
    ])
  })

  it('remembers the hash of a deleted entry', async () => {
    const { changes } = tracked()

    await changes.content.removeEntry('hero', 'a')

    expect(await changes.files(target)).toEqual([{ path: '.forgepress/content/hero/a.ts', removed: true, replaces: 'h-a' }])
  })

  it('keeps the hash a change started from until the change is gone', async () => {
    const { changes, store, hashes } = tracked()

    await changes.content.writeEntry('hero', row('a', 'Goodbye'))
    hashes.set('hero/a', 'h-a2')
    await changes.content.writeEntry('hero', row('a', 'Again'))

    expect((await store.read())?.hashes?.entries.hero).toEqual({ a: 'h-a' })

    await changes.content.writeEntry('hero', row('a'))

    expect((await store.read())?.hashes?.entries.hero).toEqual({})

    await changes.content.writeEntry('hero', row('a', 'Later'))

    expect((await store.read())?.hashes?.entries.hero).toEqual({ a: 'h-a2' })
  })

  it('forgets the hashes once the changes are published or discarded', async () => {
    const { changes, store, hashes } = tracked()

    await changes.content.writeEntry('hero', row('a', 'Goodbye'))
    await changes.published()
    hashes.set('hero/a', 'h-a2')
    await changes.content.writeEntry('hero', row('a', 'Again'))

    expect((await store.read())?.hashes?.entries.hero).toEqual({ a: 'h-a2' })

    await changes.discard()
    hashes.set('hero/a', 'h-a3')
    await changes.content.writeEntry('hero', row('a', 'Later'))

    expect((await store.read())?.hashes?.entries.hero).toEqual({ a: 'h-a3' })
  })

  it('records no hashes without a source for them', async () => {
    const { changes, store } = make()

    await changes.content.writeEntry('hero', row('a', 'Goodbye'))

    expect((await store.read())?.hashes).toBeUndefined()
    expect((await changes.files(target)).map(item => [item.path, item.replaces])).toEqual([['.forgepress/content/hero/a.ts', undefined]])
  })

  it('keeps my version of conflicting files to replace their current version', async () => {
    const { changes } = tracked()

    await changes.content.writeEntry('hero', row('a', 'Goodbye'))
    await changes.content.writeEntry('author', row('x'))
    await changes.resolve([
      { path: '.forgepress/content/hero/a.ts', hash: 'h-theirs' },
      { path: '.forgepress/content/author/x.ts', hash: 'h-x' },
    ], target, 'mine')

    expect(await replaced(changes)).toEqual([
      ['.forgepress/content/hero/a.ts', 'h-theirs'],
      ['.forgepress/content/author/x.ts', 'h-x'],
    ])
    expect(await changes.content.entry('hero', 'a')).toEqual(row('a', 'Goodbye'))
  })

  it('drops only my changes to conflicting files', async () => {
    const { changes } = tracked()
    const nested = { ...target, base: 'apps/site' }

    await changes.content.writeEntry('hero', row('a', 'Goodbye'))
    await changes.content.writeEntry('author', row('x'))
    await changes.resolve([
      { path: 'apps/site/.forgepress/content/hero/a.ts', hash: null },
    ], nested, 'theirs')

    expect(await changes.content.entry('hero', 'a')).toEqual(row('a'))
    expect(await replaced(changes)).toEqual([['.forgepress/content/author/x.ts', null]])
    expect((await changes.summary()).written).toEqual([{ collection: 'author', id: 'x' }])
  })
})
