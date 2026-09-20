import type { ContentEntries } from '../../src/entries/references'
import type { Entry } from '../../src/entries/types'
import type { ForgePressSchema } from '../../src/schema/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOutput } from '../../src/output'
import { Builder } from '../../src/query/builder'
import { createLoader } from '../../src/query/client'

const schema = {
  locales: ['en', 'de'],
  components: {
    card: { fields: { caption: { type: 'text', translate: true }, by: { type: 'collection', collections: ['author'], optional: true } } },
    quote: { fields: { saying: { type: 'text' }, source: { type: 'collection', collections: ['author', 'hero'], optional: true } } },
  },
  collections: {
    author: {
      fields: {
        name: { type: 'text', index: true },
        posts: { type: 'collection', collections: ['post'], multiple: true, optional: true },
      },
    },
    post: {
      fields: {
        title: { type: 'text', translate: true, index: true },
        views: { type: 'number', optional: true },
        author: { type: 'collection', collections: ['author'], index: true },
        blocks: { type: 'collection', collections: ['hero', 'author'], multiple: true, optional: true },
        mixed: { type: 'component', components: ['card', 'quote'], multiple: true, optional: true },
      },
    },
    hero: {
      fields: {
        headline: { type: 'text', translate: true },
      },
    },
  },
} as const satisfies ForgePressSchema

function entry(id: string, createdAt: string, fields: Record<string, unknown>, status: Entry['status'] = 'published'): Entry {
  return { id, status, createdAt, updatedAt: createdAt, ...fields }
}

const content: ContentEntries = {
  author: {
    alice: entry('alice', '2024-01-01T00:00:00Z', { name: 'Alice', posts: ['p1', 'p2'] }),
    bob: entry('bob', '2024-02-01T00:00:00Z', { name: 'Bob', posts: ['p3'] }),
    carol: entry('carol', '2024-03-01T00:00:00Z', { name: 'Carol' }, 'unpublished'),
  },
  post: {
    p1: entry('p1', '2024-01-05T00:00:00Z', {
      title: { en: 'First', de: 'Erster' },
      views: 10,
      author: 'alice',
      blocks: [{ collection: 'hero', id: 'h1' }, { collection: 'author', id: 'bob' }],
      mixed: [
        { component: 'card', caption: { en: 'A card', de: 'Eine Karte' }, by: 'bob' },
        { component: 'quote', saying: 'Words', source: { collection: 'hero', id: 'h1' } },
      ],
    }),
    p2: entry('p2', '2024-01-10T00:00:00Z', { title: { en: 'Second', de: 'Zweiter' }, views: 30, author: 'alice' }),
    p3: entry('p3', '2024-01-15T00:00:00Z', { title: { en: 'Third', de: 'Dritter' }, views: 20, author: 'bob' }),
  },
  hero: {
    h1: entry('h1', '2024-01-01T00:00:00Z', { headline: { en: 'Hello', de: 'Hallo' } }),
  },
}

async function site(dev = false) {
  const files = new Map((await createOutput(schema, content, { commit: null, dev })).map(file => [file.path, JSON.parse(file.text) as unknown]))
  const reads: string[] = []
  const loader = createLoader(async (path) => {
    reads.push(path.replace(/\.[\da-f]{8}\.json$/, ''))

    return structuredClone(files.get(path))
  })

  return {
    reads,
    query: (collection: string) => new Builder(loader, collection),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('queries', () => {
  it('list published entries in creation order, resolved for the locale', async () => {
    const { query } = await site()

    expect(await query('post').locale('de')).toEqual([
      {
        id: 'p1',
        createdAt: '2024-01-05T00:00:00Z',
        updatedAt: '2024-01-05T00:00:00Z',
        title: 'Erster',
        views: 10,
        author: { collection: 'author', id: 'alice' },
        blocks: [{ collection: 'hero', id: 'h1' }, { collection: 'author', id: 'bob' }],
        mixed: [
          { component: 'card', caption: 'Eine Karte', by: { collection: 'author', id: 'bob' } },
          { component: 'quote', saying: 'Words', source: { collection: 'hero', id: 'h1' } },
        ],
      },
      { id: 'p2', createdAt: '2024-01-10T00:00:00Z', updatedAt: '2024-01-10T00:00:00Z', title: 'Zweiter', views: 30, author: { collection: 'author', id: 'alice' } },
      { id: 'p3', createdAt: '2024-01-15T00:00:00Z', updatedAt: '2024-01-15T00:00:00Z', title: 'Dritter', views: 20, author: { collection: 'author', id: 'bob' } },
    ])
    expect((await query('author')).map(author => author.id)).toEqual(['alice', 'bob'])
  })

  it('need .locale() for translated collections and a locale of the site', async () => {
    const { query } = await site()

    await expect(Promise.resolve(query('post'))).rejects.toThrow('[forgepress] "post" is translated, so query("post") needs .locale(), such as .locale("en")')
    await expect(Promise.resolve(query('post').locale('fr'))).rejects.toThrow('[forgepress] "fr" is not a locale of this site; use "en", "de"')
    await expect(Promise.resolve(query('page'))).rejects.toThrow('[forgepress] the content output has no collection "page"')
  })

  it('filter and sort indexed fields in the manifest and read only the entries they return', async () => {
    const { query, reads } = await site()

    expect(await query('post').locale('en').where('author', 'alice').sort('title', 'desc').limit(1)).toMatchObject([{ id: 'p2', title: 'Second' }])
    expect(reads).toEqual(['index.json', 'post/en/index', 'post/en/p2'])
  })

  it('pick indexed fields without reading any entry', async () => {
    const { query, reads } = await site()

    expect(await query('author').sort('name', 'desc').pick('id', 'name')).toEqual([{ id: 'bob', name: 'Bob' }, { id: 'alice', name: 'Alice' }])
    expect(reads).toEqual(['index.json', 'author/index'])
  })

  it('read every entry to filter by a field that is not indexed, and say so in development', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const built = await site()

    expect((await built.query('post').locale('en').where('views', 'gt', 15)).map(post => post.id)).toEqual(['p2', 'p3'])
    expect(built.reads).toEqual(['index.json', 'post/en/index', 'post/en/p1', 'post/en/p2', 'post/en/p3'])
    expect(warn).not.toHaveBeenCalled()

    const dev = await site(true)

    await dev.query('post').locale('en').sort('views')
    expect(warn).toHaveBeenCalledWith('[forgepress] query("post") filters or sorts by "views", which is not indexed, so every entry is loaded. Add index: true to the field in the schema')
  })

  it('read one entry for first()', async () => {
    const { query, reads } = await site()

    expect(await query('post').locale('en').offset(1).first()).toMatchObject({ id: 'p2' })
    expect(await query('post').locale('en').where('title', 'Nothing').first()).toBeUndefined()
    expect(reads.filter(path => path.startsWith('post/en/p'))).toEqual(['post/en/p2'])
  })

  it('load relations as entries and blocks with their collection', async () => {
    const { query } = await site()
    const post = await query('post').locale('en').with('author').with('blocks').first()

    expect(post).toMatchObject({
      author: { id: 'alice', name: 'Alice', posts: [{ collection: 'post', id: 'p1' }, { collection: 'post', id: 'p2' }] },
      blocks: [
        { collection: 'hero', id: 'h1', entry: { id: 'h1', headline: 'Hello' } },
        { collection: 'author', id: 'bob', entry: { id: 'bob', name: 'Bob' } },
      ],
    })

    expect((await query('author').locale('de').with('posts')).map(author => (author.posts as { title: string }[]).map(item => item.title))).toEqual([['Erster', 'Zweiter'], ['Dritter']])
  })

  it('load the entries that items point at, keeping the item shape and its locale', async () => {
    const { query } = await site()
    const post = await query('post').locale('de').with('mixed').first()

    expect(post).toMatchObject({
      mixed: [
        { component: 'card', caption: 'Eine Karte', by: { id: 'bob', name: 'Bob' } },
        { component: 'quote', saying: 'Words', source: { collection: 'hero', id: 'h1', entry: { id: 'h1', headline: 'Hallo' } } },
      ],
    })
  })

  it('follow a path into the entries it has loaded', async () => {
    const { query } = await site()
    const post = await query('post').locale('en').with('author.posts').first()

    expect(post).toMatchObject({ author: { name: 'Alice', posts: [{ id: 'p1', title: 'First' }, { id: 'p2', title: 'Second' }] } })

    const deep = await query('post').locale('de').with('mixed.by.posts').first()

    expect(deep).toMatchObject({
      mixed: [
        { component: 'card', by: { name: 'Bob', posts: [{ id: 'p3', title: 'Dritter' }] } },
        { component: 'quote', source: { collection: 'hero', id: 'h1', entry: { id: 'h1', headline: 'Hallo' } } },
      ],
    })
  })

  it('follow a path only into the collections that have the field', async () => {
    const { query } = await site()
    const post = await query('post').locale('en').with('blocks.posts').first()

    expect(post).toMatchObject({
      blocks: [
        { collection: 'hero', entry: { headline: 'Hello' } },
        { collection: 'author', entry: { name: 'Bob', posts: [{ id: 'p3', title: 'Third' }] } },
      ],
    })
  })

  it('take several calls, and a path reaches further than the field it starts with', async () => {
    const { query, reads } = await site()
    const post = await query('post').locale('en').with('author').with('author.posts').with('blocks').first()

    expect(post).toMatchObject({
      author: { name: 'Alice', posts: [{ id: 'p1', title: 'First' }, { id: 'p2', title: 'Second' }] },
      blocks: [{ collection: 'hero', entry: { headline: 'Hello' } }, { collection: 'author', entry: { name: 'Bob' } }],
    })

    expect(reads.filter(path => path === 'author/alice')).toEqual(['author/alice'])
  })

  it('need a locale to load translated entries, and a field that links', async () => {
    const { query } = await site()

    await expect(Promise.resolve(query('author').with('posts'))).rejects.toThrow('[forgepress] .with("posts") loads "post" entries, which are translated, so query("author") needs .locale(), such as .locale("en")')
    await expect(Promise.resolve(query('author').with('name'))).rejects.toThrow('[forgepress] .with("name") loads fields that link to entries, and "name" is not one in "author"')
    await expect(Promise.resolve(query('post').locale('en').with('mixed.writer'))).rejects.toThrow('[forgepress] .with("mixed.writer") stops at "writer", which does not link to entries')
  })

  it('return copies, so changing a result changes nothing else', async () => {
    const { query } = await site()
    const [first] = await query('author').with('posts').locale('en')

    first!.name = 'Changed'
    ;(first!.posts as { title: string }[])[0]!.title = 'Changed'

    expect(await query('author').locale('en').with('posts').first()).toMatchObject({ name: 'Alice', posts: [{ title: 'First' }, { title: 'Second' }] })
  })
})
