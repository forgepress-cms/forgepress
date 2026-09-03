import type { BakedMedia, StoredMedia } from '../src/types/content/media'
import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '../src/content/changes'
import { createMediaBuffer } from '../src/content/media/browser'

const hero = {
  name: 'hero.abc12345.png',
  url: '/uploads/hero.abc12345.png',
  type: 'image/png',
  size: 12,
  modifiedAt: '2026-01-01T00:00:00.000Z',
}

function baked(maxSize = 1024): BakedMedia {
  return { dir: 'public/uploads', url: '/uploads', maxSize, assets: [hero] }
}

function buffer(maxSize?: number, store = createMemoryStore<StoredMedia>()) {
  return { media: createMediaBuffer(async () => baked(maxSize), store), store }
}

function file(name: string, bytes = 'hello', type = 'image/png'): File {
  return new File([bytes], name, { type })
}

describe('listing', () => {
  it('returns the baked assets while nothing is pending', async () => {
    const { media } = buffer()

    expect((await media.list()).map(asset => asset.name)).toEqual([hero.name])
  })

  it('shows a pending upload alongside the baked assets', async () => {
    const { media } = buffer()

    await media.upload(file('photo.png'))

    expect(await media.list()).toHaveLength(2)
  })

  it('hides a removed baked asset', async () => {
    const { media } = buffer()

    await media.remove(hero.name)

    expect(await media.list()).toEqual([])
  })
})

describe('upload', () => {
  it('names the asset from its content and points at the published path', async () => {
    const { media } = buffer()
    const asset = await media.upload(file('My Photo.png'))

    expect(asset.name).toMatch(/^my-photo\.[0-9a-f]{8}\.png$/)
    expect(asset.url).toBe(`/uploads/${asset.name}`)
    expect(asset.type).toBe('image/png')
  })

  it('gives identical bytes the same name twice', async () => {
    const { media } = buffer()

    const first = await media.upload(file('photo.png'))
    const second = await media.upload(file('photo.png'))

    expect(second.name).toBe(first.name)
    expect(await media.list()).toHaveLength(2)
  })

  it('rejects an unsupported file type', async () => {
    const { media } = buffer()

    await expect(media.upload(file('notes.txt'))).rejects.toThrow('not a supported media file')
  })

  it('rejects a file over the configured limit', async () => {
    const { media } = buffer(4)

    await expect(media.upload(file('photo.png', 'far too many bytes'))).rejects.toThrow('upload limit')
  })
})

describe('removal', () => {
  it('drops a pending upload outright', async () => {
    const { media, store } = buffer()
    const asset = await media.upload(file('photo.png'))

    await media.remove(asset.name)

    expect((await store.read())!.uploads).toEqual({})
    expect((await store.read())!.removed).toEqual([])
  })

  it('tombstones a baked asset so publishing can delete it', async () => {
    const { media, store } = buffer()

    await media.remove(hero.name)

    expect((await store.read())!.removed).toEqual([hero.name])
  })

  it('does not tombstone the same asset twice', async () => {
    const { media, store } = buffer()

    await media.remove(hero.name)
    await media.remove(hero.name)

    expect((await store.read())!.removed).toEqual([hero.name])
  })
})

describe('persistence', () => {
  it('resumes pending uploads from the store', async () => {
    const store = createMemoryStore<StoredMedia>()

    await buffer(undefined, store).media.upload(file('photo.png'))

    expect(await buffer(undefined, store).media.list()).toHaveLength(2)
  })

  it('discards everything back to the baked listing', async () => {
    const { media, store } = buffer()

    await media.upload(file('photo.png'))
    await media.remove(hero.name)
    await media.discard()

    expect((await media.list()).map(asset => asset.name)).toEqual([hero.name])
    expect(await store.read()).toBeUndefined()
  })
})
