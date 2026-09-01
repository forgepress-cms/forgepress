import type { ContentRow } from '../src/types/content/reader'
import type { WebenvSchema } from '../src/types/core/schema'
import type { QueryBackend } from '../src/types/query'
import { describe, expect, it } from 'vitest'
import { createBuilder } from '../src/query/builder'

const schema = {
  locales: ['en', 'de'],
  components: {
    author: {
      elements: {
        name: { type: 'text' },
        bio: { type: 'richtext', translate: true },
        posts: { type: 'relation', component: 'post', multiple: true },
      },
    },
    post: {
      elements: {
        title: { type: 'text', translate: true },
        views: { type: 'number' },
        author: { type: 'relation', component: 'author' },
      },
    },
  },
} as const satisfies WebenvSchema

function fixtures(): Record<string, ContentRow[]> {
  return {
    author: [
      { id: 'a1', status: 'published', createdAt: '2024-01-01', updatedAt: '2024-01-01', name: 'Alice', bio: { en: 'Alice bio', de: 'Alice Bio' }, posts: ['p1', 'p2'] },
      { id: 'a2', status: 'draft', createdAt: '2024-02-01', updatedAt: '2024-02-01', name: 'Bob', bio: { en: 'Bob bio', de: 'Bob Bio' }, posts: ['p3'] },
    ],
    post: [
      { id: 'p1', status: 'published', createdAt: '2024-01-05', updatedAt: '2024-01-05', title: { en: 'First', de: 'Erste' }, views: 10, author: 'a1' },
      { id: 'p2', status: 'published', createdAt: '2024-01-10', updatedAt: '2024-01-10', title: { en: 'Second', de: 'Zweite' }, views: 30, author: 'a1' },
      { id: 'p3', status: 'archived', createdAt: '2024-01-15', updatedAt: '2024-01-15', title: { en: 'Third', de: 'Dritte' }, views: 20, author: 'a2' },
    ],
  }
}

function backend(content: Record<string, ContentRow[]>): QueryBackend {
  return {
    reader: {
      schema: async () => schema,
      list: async component => content[component] ?? [],
      get: async (component, id) => (content[component] ?? []).find(row => row.id === id),
    },
    schema: async () => schema,
  }
}

function query(component: string, content = fixtures()) {
  return createBuilder(component, backend(content))
}

const ids = (rows: ContentRow[]) => rows.map(row => row.id)

describe('where', () => {
  it('two-argument form is an eq shorthand', async () => {
    expect(ids(await query('post').where('status', 'published'))).toEqual(['p1', 'p2'])
  })

  it('three-argument form takes an operator', async () => {
    expect(ids(await query('post').where('views', 'gt', 15))).toEqual(['p2', 'p3'])
  })

  it('matches against relation id arrays with contains', async () => {
    expect(ids(await query('author').where('posts', 'contains', 'p1'))).toEqual(['a1'])
  })
})

describe('sort, limit, offset', () => {
  it('sorts by a field', async () => {
    expect(ids(await query('post').sort('views', 'desc'))).toEqual(['p2', 'p3', 'p1'])
  })

  it('paginates with offset and limit', async () => {
    expect(ids(await query('post').sort('views', 'asc').offset(1).limit(1))).toEqual(['p3'])
  })
})

describe('locale', () => {
  it('flattens translated fields to the chosen locale', async () => {
    const posts = await query('post').locale('de')
    expect(posts[0]!.title).toBe('Erste')
  })

  it('leaves translated maps intact when not called', async () => {
    const posts = await query('post')
    expect(posts[0]!.title).toEqual({ en: 'First', de: 'Erste' })
  })
})

describe('with', () => {
  it('resolves a single relation to its row', async () => {
    const post = await query('post').where('id', 'p1').first()
    const resolved = (await query('post').where('id', 'p1').with('author'))[0]!
    expect(post!.author).toBe('a1')
    expect((resolved.author as ContentRow).name).toBe('Alice')
  })

  it('resolves a multiple relation to an array of rows', async () => {
    const author = (await query('author').where('id', 'a1').with('posts'))[0]!
    expect(ids(author.posts as ContentRow[])).toEqual(['p1', 'p2'])
  })

  it('localizes resolved relation rows when a locale is active', async () => {
    const author = (await query('author').locale('en').with('posts'))[0]!
    expect((author.posts as ContentRow[])[0]!.title).toBe('First')
  })

  it('drops relation ids that do not resolve', async () => {
    const content = fixtures()
    content.author![0]!.posts = ['p1', 'missing']
    const author = (await createBuilder('author', backend(content)).where('id', 'a1').with('posts'))[0]!
    expect(ids(author.posts as ContentRow[])).toEqual(['p1'])
  })
})

describe('pick', () => {
  it('projects rows down to the chosen fields', async () => {
    const posts = await query('post').pick('id', 'views')
    expect(Object.keys(posts[0]!)).toEqual(['id', 'views'])
  })

  it('runs after where/sort/with so dropped fields can still drive the query', async () => {
    const posts = await query('post').locale('en').with('author').where('status', 'published').sort('views', 'desc').pick('title')
    expect(posts.map(row => row.title)).toEqual(['Second', 'First'])
    expect(Object.keys(posts[0]!)).toEqual(['title'])
  })
})

describe('first', () => {
  it('returns the first row', async () => {
    expect((await query('post').sort('views', 'asc').first())!.id).toBe('p1')
  })

  it('returns undefined when nothing matches', async () => {
    expect(await query('post').where('status', 'nope').first()).toBeUndefined()
  })
})

describe('thenable', () => {
  it('is awaitable and chains through then()', async () => {
    const count = await query('post').then(rows => rows.length)
    expect(count).toBe(3)
  })
})

describe('immutability', () => {
  it('does not mutate the source rows when resolving relations', async () => {
    const content = fixtures()
    await createBuilder('post', backend(content)).locale('en').with('author')
    expect(content.post![0]!.author).toBe('a1')
    expect(content.post![0]!.title).toEqual({ en: 'First', de: 'Erste' })
  })
})

describe('combinations', () => {
  it('applies locale, where, sort and limit together', async () => {
    const posts = await query('post').locale('en').where('status', 'published').sort('views', 'desc').limit(1)
    expect(posts.map(row => ({ id: row.id, title: row.title }))).toEqual([{ id: 'p2', title: 'Second' }])
  })
})
