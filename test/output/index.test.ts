import type { ContentEntries } from '../../src/entries/references'
import type { OutputFile, OutputIndex, OutputManifest } from '../../src/output/types'
import type { ForgePressSchema } from '../../src/types/schema'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createOutput } from '../../src/output'

const schema = {
  locales: ['en', 'de'],
  collections: {
    author: {
      fields: {
        name: { type: 'text', index: true },
        portrait: { type: 'image', optional: true },
      },
    },
    blogPost: {
      fields: {
        title: { type: 'text', translate: true, index: true },
        summary: { type: 'text', translate: true, optional: true, index: true },
        author: { type: 'relation', collection: 'author', index: true },
        blocks: { type: 'dynamic', collections: ['hero'], optional: true },
      },
    },
    hero: {
      fields: {
        headline: { type: 'text' },
      },
    },
  },
} as const satisfies ForgePressSchema

function content(): Record<string, Record<string, Record<string, unknown>>> {
  return {
    author: {
      author_1: { id: 'author_1', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', name: 'Alice', portrait: { url: '/uploads/alice.png' } },
      author_2: { id: 'author_2', status: 'unpublished', createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z', name: 'Bob' },
    },
    blogPost: {
      post_2: { id: 'post_2', status: 'published', createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-03-01T00:00:00Z', title: { en: 'Second', de: 'Zweiter' }, author: 'author_1' },
      post_1: { id: 'post_1', status: 'published', createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-05T00:00:00Z', title: { en: 'First', de: 'Erster' }, summary: { en: 'Short' }, author: 'author_1', blocks: [{ collection: 'hero', id: 'hero_1' }] },
    },
  }
}

async function output(entries = content(), options: { commit: string | null, dev?: boolean } = { commit: 'b03db8f3643a31d7dfaf48ccf77777a33e5e42ae' }): Promise<Map<string, string>> {
  const files = await createOutput(schema, entries as ContentEntries, options)

  return new Map(files.map((file: OutputFile) => [file.path, file.text]))
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 8)
}

function read<TValue>(files: Map<string, string>, path: string): TValue {
  return JSON.parse(files.get(path)!) as TValue
}

describe('createOutput', () => {
  it('names every file after its content and ends with the root index', async () => {
    const files = await createOutput(schema, content() as ContentEntries, { commit: null })

    expect(files.at(-1)!.path).toBe('index.json')

    for (const file of files.slice(0, -1))
      expect(file.path).toMatch(new RegExp(`^[a-z-]+(?:/(?:en|de))?/[\\w-]+\\.${hash(file.text)}\\.json$`))

    expect(files.map(file => file.path.replace(/\.[\da-f]{8}\.json$/, ''))).toEqual([
      'author/author_1',
      'author/index',
      'blog-post/en/post_1',
      'blog-post/en/post_2',
      'blog-post/en/index',
      'blog-post/de/post_1',
      'blog-post/de/post_2',
      'blog-post/de/index',
      'hero/index',
      'index.json',
    ])
  })

  it('links the manifests from a readable root index with the commit and locales', async () => {
    const files = await output()
    const index = read<OutputIndex>(files, 'index.json')

    expect(files.get('index.json')).toBe(`${JSON.stringify(index, null, 2)}\n`)
    expect(index).toEqual({
      version: 1,
      commit: 'b03db8f3643a31d7dfaf48ccf77777a33e5e42ae',
      locales: ['en', 'de'],
      collections: {
        author: { localized: false, manifest: expect.stringMatching(/^author\/index\.[\da-f]{8}\.json$/) },
        blogPost: {
          localized: true,
          manifests: {
            en: expect.stringMatching(/^blog-post\/en\/index\.[\da-f]{8}\.json$/),
            de: expect.stringMatching(/^blog-post\/de\/index\.[\da-f]{8}\.json$/),
          },
        },
        hero: { localized: false, manifest: expect.stringMatching(/^hero\/index\.[\da-f]{8}\.json$/) },
      },
    })

    expect([...files.keys()]).toEqual(expect.arrayContaining(Object.values(index.collections).flatMap(collection => collection.localized ? Object.values(collection.manifests) : [collection.manifest])))
  })

  it('lists published entries in creation order with their indexed fields in each locale', async () => {
    const files = await output()
    const index = read<OutputIndex>(files, 'index.json')
    const manifests = index.collections.blogPost as { manifests: Record<string, string> }
    const english = read<OutputManifest>(files, manifests.manifests.en!)
    const german = read<OutputManifest>(files, manifests.manifests.de!)
    const authors = read<OutputManifest>(files, (index.collections.author as { manifest: string }).manifest)

    expect(english.indexed).toEqual(['title', 'summary', 'author'])
    expect(english.links).toEqual({ author: 'relation', blocks: 'dynamic' })
    expect(english.entries).toEqual([
      { id: 'post_1', createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-05T00:00:00Z', title: 'First', summary: 'Short', author: { collection: 'author', id: 'author_1' } },
      { id: 'post_2', createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-03-01T00:00:00Z', title: 'Second', author: { collection: 'author', id: 'author_1' } },
    ])
    expect(german.entries.map(entry => [entry.title, entry.summary])).toEqual([['Erster', undefined], ['Zweiter', undefined]])
    expect(Object.keys(german.files)).toEqual(['post_1', 'post_2'])

    expect(authors).toEqual({
      indexed: ['name'],
      links: {},
      entries: [{ id: 'author_1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', name: 'Alice' }],
      files: { author_1: expect.stringMatching(/^author\/author_1\.[\da-f]{8}\.json$/) },
    })
  })

  it('writes entries resolved for their locale', async () => {
    const files = await output()
    const german = read<OutputManifest>(files, (read<OutputIndex>(files, 'index.json').collections.blogPost as { manifests: Record<string, string> }).manifests.de!)

    expect(read(files, german.files.post_1!)).toEqual({
      id: 'post_1',
      createdAt: '2024-02-01T00:00:00Z',
      updatedAt: '2024-02-05T00:00:00Z',
      title: 'Erster',
      author: { collection: 'author', id: 'author_1' },
      blocks: [{ collection: 'hero', id: 'hero_1' }],
    })
  })

  it('keeps the names of files whose content did not change', async () => {
    const before = await output()
    const changed = content()

    changed.blogPost!.post_2!.title = { en: 'Second, edited', de: 'Zweiter, bearbeitet' }

    const after = await output(changed)
    const names = (files: Map<string, string>): string[] => [...files.keys()]
    const gone = names(before).filter(path => !after.has(path))

    expect(gone.map(path => path.replace(/\.[\da-f]{8}\.json$/, ''))).toEqual(['blog-post/en/post_2', 'blog-post/en/index', 'blog-post/de/post_2', 'blog-post/de/index'])
    expect(await output(changed)).toEqual(after)
  })

  it('marks output for development and works without locales', async () => {
    const files = new Map((await createOutput({ collections: { page: { fields: { title: { type: 'text', index: true } } } } }, {
      page: { page_1: { id: 'page_1', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', title: 'Home' } },
    }, { commit: null, dev: true })).map(file => [file.path, file.text]))

    const index = read<OutputIndex>(files, 'index.json')

    expect(index).toEqual({ version: 1, commit: null, dev: true, locales: [], collections: { page: { localized: false, manifest: expect.stringMatching(/^page\/index\.[\da-f]{8}\.json$/) } } })
    expect(read<OutputManifest>(files, (index.collections.page as { manifest: string }).manifest).entries).toEqual([
      { id: 'page_1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', title: 'Home' },
    ])
  })
})
