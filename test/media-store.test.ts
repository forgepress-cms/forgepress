import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMediaStore } from '../src/disk/media'

const bytes = new TextEncoder().encode('a tiny png')

let root = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'forgepress-media-'))
})

describe('media store', () => {
  it('writes uploads under a content addressed name', async () => {
    const store = createMediaStore(root)
    const asset = await store.write({ name: 'Hero Banner.PNG', data: bytes })

    expect(asset.name).toMatch(/^hero-banner\.[0-9a-f]{8}\.png$/)
    expect(asset.url).toBe(`/uploads/${asset.name}`)
    expect(asset.type).toBe('image/png')
    expect(asset.size).toBe(bytes.byteLength)

    expect(await readdir(join(root, 'public/uploads'))).toEqual([asset.name])
  })

  it('stores the same file once', async () => {
    const store = createMediaStore(root)

    const first = await store.write({ name: 'hero.png', data: bytes })
    const second = await store.write({ name: 'hero.png', data: bytes })

    expect(second.name).toBe(first.name)
    expect(await readdir(join(root, 'public/uploads'))).toHaveLength(1)
  })

  it('follows a configured directory and public url', async () => {
    const store = createMediaStore(root, { dir: 'static/media', url: 'https://cdn.example.com/media' })
    const asset = await store.write({ name: 'hero.png', data: bytes })

    expect(asset.url).toBe(`https://cdn.example.com/media/${asset.name}`)
    expect(await readdir(join(root, 'static/media'))).toEqual([asset.name])
  })

  it('refuses files that are not media', async () => {
    const store = createMediaStore(root)

    await expect(store.write({ name: 'payload.ts', data: bytes })).rejects.toThrow(/not a supported media file/)
  })

  it('refuses uploads over the limit', async () => {
    const store = createMediaStore(root, { maxSize: 4 })

    await expect(store.write({ name: 'hero.png', data: bytes })).rejects.toThrow(/upload limit/)
  })

  it('lists uploaded media and skips foreign files', async () => {
    const store = createMediaStore(root)

    const first = await store.write({ name: 'first.png', data: new TextEncoder().encode('one') })
    const second = await store.write({ name: 'second.png', data: new TextEncoder().encode('two') })

    await writeFile(join(root, 'public/uploads/notes.txt'), 'ignored')

    expect((await store.list()).map(asset => asset.name).sort()).toEqual([first.name, second.name].sort())
  })

  it('lists nothing before the first upload', async () => {
    expect(await createMediaStore(root).list()).toEqual([])
  })

  it('removes an asset and rejects traversal', async () => {
    const store = createMediaStore(root)
    const asset = await store.write({ name: 'hero.png', data: bytes })

    await expect(store.remove('../../etc/passwd')).rejects.toThrow(/not a valid asset name/)

    await store.remove(asset.name)

    expect(await store.list()).toEqual([])
  })
})
