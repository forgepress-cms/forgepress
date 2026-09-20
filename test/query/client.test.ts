import type { OutputIndex } from '../../src/output/types'
import { describe, expect, it } from 'vitest'
import { createLoader } from '../../src/query/client'

function site(files: Record<string, unknown>) {
  const reads: string[] = []
  const read = async (path: string): Promise<unknown> => {
    reads.push(path)

    return structuredClone(files[path])
  }

  return { reads, read, files }
}

const index: OutputIndex = {
  version: 3,
  commit: null,
  locales: ['en'],
  collections: {
    author: { localized: false, manifest: 'author/index.1.json' },
    post: { localized: true, manifests: { en: 'post/en/index.1.json' } },
  },
}

const manifest = (file: string) => ({ indexed: [], links: {}, entries: [{ id: 'alice', createdAt: '', updatedAt: '' }], files: { alice: file } })

describe('createLoader', () => {
  it('reads the root index for every query and each other file once', async () => {
    const { reads, read } = site({
      'index.json': index,
      'author/index.1.json': manifest('author/alice.1.json'),
      'author/alice.1.json': { id: 'alice', name: 'Alice' },
    })
    const loader = createLoader(read)

    for (let run = 0; run < 2; run += 1)
      expect(await loader.run(async snapshot => snapshot.entries('author', undefined, ['alice', 'nobody']))).toEqual([{ id: 'alice', name: 'Alice' }])

    expect(reads).toEqual(['index.json', 'author/index.1.json', 'author/alice.1.json', 'index.json'])
  })

  it('finds the manifest of a locale and ignores the locale for untranslated collections', async () => {
    const { read } = site({ 'index.json': index, 'post/en/index.1.json': manifest('post/en/alice.1.json'), 'author/index.1.json': manifest('author/alice.1.json') })
    const loader = createLoader(read)

    await expect(loader.run(async snapshot => (await snapshot.manifest('post', 'en')).files)).resolves.toEqual({ alice: 'post/en/alice.1.json' })
    await expect(loader.run(async snapshot => (await snapshot.manifest('author', 'en')).files)).resolves.toEqual({ alice: 'author/alice.1.json' })
    await expect(loader.run(async snapshot => snapshot.manifest('post', 'de'))).rejects.toThrow('[forgepress] the content output has no "post" entries in locale "de"')
    await expect(loader.run(async snapshot => snapshot.manifest('page', undefined))).rejects.toThrow('[forgepress] the content output has no collection "page"')
  })

  it('starts over once when a file is gone because the site was deployed again', async () => {
    const deployed: OutputIndex = { ...index, collections: { ...index.collections, author: { localized: false, manifest: 'author/index.2.json' } } }
    const { reads, read } = site({ 'author/index.2.json': manifest('author/alice.2.json'), 'author/alice.2.json': { id: 'alice', name: 'Alice Smith' } })
    let roots = 0

    const loader = createLoader(async (path) => {
      if (path !== 'index.json')
        return read(path)

      reads.push(path)
      roots += 1

      return roots === 1 ? index : deployed
    })

    expect(await loader.run(async snapshot => snapshot.entries('author', undefined, ['alice']))).toEqual([{ id: 'alice', name: 'Alice Smith' }])
    expect(reads).toEqual(['index.json', 'author/index.1.json', 'index.json', 'author/index.2.json', 'author/alice.2.json'])
  })

  it('gives up when the file is still missing', async () => {
    const { read } = site({ 'index.json': index, 'author/index.1.json': manifest('author/alice.1.json') })

    await expect(createLoader(read).run(async snapshot => snapshot.entries('author', undefined, ['alice'])))
      .rejects
      .toThrow('[forgepress] the content output links author/alice.1.json, but the file doesn\'t exist')
  })

  it('explains a missing or unknown content output', async () => {
    await expect(createLoader(site({}).read).run(async () => undefined)).rejects.toThrow('[forgepress] there is no content output yet: index.json is missing')
    await expect(createLoader(site({ 'index.json': { ...index, version: 1 } }).read).run(async () => undefined))
      .rejects
      .toThrow('[forgepress] the content output has format version 1, but this version of forgepress reads version 3')
  })
})
