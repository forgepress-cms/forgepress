import type { ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { validateEntry } from '../../src/entries/validate'

const schema = {
  locales: ['en', 'de'],
  collections: {
    post: {
      fields: {
        title: { type: 'text', translate: true },
        summary: { type: 'text', translate: true, optional: true },
        body: { type: 'richtext' },
        rating: { type: 'number', optional: true },
        cover: { type: 'image', optional: true },
        gallery: { type: 'image', multiple: true, optional: true },
        author: { type: 'collection', collections: ['author'] },
        related: { type: 'collection', collections: ['post'], multiple: true, optional: true },
        blocks: { type: 'collection', collections: ['hero', 'post'], multiple: true, optional: true },
        slug: { type: 'text', validation: '^[a-z0-9-]+$', optional: true },
        code: { type: 'text', validation: '^[A-Z]{2}$', translate: true, optional: true },
        score: { type: 'number', min: 1, max: 5, step: 0.5, optional: true },
        amount: { type: 'number', step: 0.1, optional: true },
      },
    },
    author: { fields: {} },
    hero: { fields: {} },
    flag: { fields: { featured: { type: 'boolean' } } },
  },
} as const satisfies ForgePressSchema

const post = {
  id: 'post_1',
  status: 'published',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T10:30:00.123+02:00',
  title: { en: 'Hello', de: 'Hallo' },
  body: 'Text',
  author: 'author_1',
}

function issues(entry: unknown, collection = 'post'): { path: readonly (string | number)[], message: string }[] {
  return validateEntry(schema, collection, entry)
}

describe('validateEntry', () => {
  it('accepts a complete entry', () => {
    expect(issues(post)).toEqual([])
  })

  it('accepts every optional field filled in', () => {
    expect(issues({
      ...post,
      summary: { de: 'Kurz' },
      rating: 4.5,
      cover: { url: '/uploads/a.png', alt: 'A', width: 800, height: 600 },
      gallery: [{ url: '/uploads/a.png' }, { url: '/uploads/b.png' }],
      related: ['post_2'],
      blocks: [{ collection: 'hero', id: 'hero_1' }],
    })).toEqual([])
  })

  it('accepts empty values the types allow', () => {
    expect(issues({ ...post, body: '', summary: {}, related: [], blocks: [] })).toEqual([])
  })

  it('wants an object of a collection in the schema', () => {
    expect(issues([])).toEqual([{ path: [], message: 'An entry has to be an object' }])
    expect(issues(post, 'page')).toEqual([{ path: [], message: 'Collection "page" is not in the schema' }])
  })

  it('checks the metadata', () => {
    expect(issues({ title: post.title, body: post.body, author: post.author })).toEqual([
      { path: [], message: 'The entry needs an "id"' },
      { path: [], message: 'The entry needs a "status"' },
      { path: [], message: 'The entry needs "createdAt"' },
      { path: [], message: 'The entry needs "updatedAt"' },
    ])

    expect(issues({ ...post, id: 'post 1', status: 'draft', createdAt: 'yesterday', updatedAt: 1 })).toEqual([
      { path: ['id'], message: '"id" has to be a string of letters, digits, "_" and "-"' },
      { path: ['status'], message: '"status" has to be "published" or "unpublished"' },
      { path: ['createdAt'], message: '"createdAt" has to be an ISO 8601 date such as "2024-01-31T09:30:00Z"' },
      { path: ['updatedAt'], message: '"updatedAt" has to be an ISO 8601 date such as "2024-01-31T09:30:00Z"' },
    ])
  })

  it.each(['2024-01-31', '2024-01-31T09:30Z', '2024-02-29T23:59:59.999999Z', '2024-01-31T09:30:00-05:00'])('accepts the date %s', (date) => {
    expect(issues({ ...post, createdAt: date })).toEqual([])
  })

  it.each(['2024-02-30', '2023-02-29', '2024-13-01', '2024-01-31T25:00:00Z', '2024-01-31T09:30:00', '31.01.2024', '2024-1-31'])('rejects the date %s', (date) => {
    expect(issues({ ...post, createdAt: date })).toHaveLength(1)
  })

  it('rejects fields the collection does not have', () => {
    expect(issues({ ...post, colour: 'red' })).toEqual([{ path: ['colour'], message: '"colour" is not a field of collection "post"' }])
  })

  it('wants the required fields', () => {
    expect(issues({ ...post, body: undefined, author: undefined })).toEqual([
      { path: [], message: 'Field "body" is required' },
      { path: [], message: 'Field "author" is required' },
    ])
  })

  it('wants every translation of a required translated field', () => {
    expect(issues({ ...post, title: { en: 'Hello' } })).toEqual([
      { path: ['title'], message: 'Field "title" is missing its de translation' },
    ])

    expect(issues({ ...post, title: {} })).toEqual([
      { path: ['title'], message: 'Field "title" is missing its en, de translations' },
    ])
  })

  it('checks translations', () => {
    expect(issues({ ...post, title: 'Hello' })).toEqual([
      { path: ['title'], message: 'Field "title" is translated and has to hold one value per locale, such as { en: … }' },
    ])

    expect(issues({ ...post, title: { en: 'Hello', de: 2, fr: 'Bonjour' } })).toEqual([
      { path: ['title', 'de'], message: 'Field "title" (de) has to be a string' },
      { path: ['title', 'fr'], message: 'Field "title" has no locale "fr"; the schema has en, de' },
    ])
  })

  it('checks text and numbers', () => {
    expect(issues({ ...post, body: 3, rating: '4' })).toEqual([
      { path: ['body'], message: 'Field "body" has to be a string' },
      { path: ['rating'], message: 'Field "rating" has to be a number' },
    ])

    expect(issues({ ...post, rating: Number.NaN })).toHaveLength(1)
  })

  it('checks booleans', () => {
    const flag = { id: 'flag_1', status: 'published', createdAt: post.createdAt, updatedAt: post.updatedAt }

    expect(issues({ ...flag, featured: false }, 'flag')).toEqual([])
    expect(issues({ ...flag, featured: 'yes' }, 'flag')).toEqual([
      { path: ['featured'], message: 'Field "featured" has to be true or false' },
    ])
    expect(issues(flag, 'flag')).toEqual([
      { path: [], message: 'Field "featured" is required' },
    ])
  })

  it('wants text to match the pattern of its field', () => {
    expect(issues({ ...post, slug: 'hello-world', code: { en: 'EN', de: 'DE' } })).toEqual([])

    expect(issues({ ...post, slug: 'Hello World', code: { en: 'EN', de: 'de' } })).toEqual([
      { path: ['slug'], message: 'Field "slug" has to match the pattern ^[a-z0-9-]+$' },
      { path: ['code', 'de'], message: 'Field "code" (de) has to match the pattern ^[A-Z]{2}$' },
    ])
  })

  it('wants numbers within the range and steps of their field', () => {
    expect(issues({ ...post, score: 1, amount: 0.3 })).toEqual([])
    expect(issues({ ...post, score: 4.5, amount: -1.2 })).toEqual([])

    expect(issues({ ...post, score: 0.5 })).toEqual([{ path: ['score'], message: 'Field "score" has to be at least 1' }])
    expect(issues({ ...post, score: 2.25 })).toEqual([{ path: ['score'], message: 'Field "score" has to be in steps of 0.5 from 1, such as 2 or 2.5' }])
    expect(issues({ ...post, amount: 0.35 })).toEqual([{ path: ['amount'], message: 'Field "amount" has to be in steps of 0.1, such as 0.3 or 0.4' }])

    expect(issues({ ...post, score: 5.2 })).toEqual([
      { path: ['score'], message: 'Field "score" has to be at most 5' },
      { path: ['score'], message: 'Field "score" has to be in steps of 0.5 from 1, such as 5' },
    ])
  })

  it('checks media', () => {
    expect(issues({ ...post, cover: [{ url: 'a.png' }], gallery: { url: 'a.png' } })).toEqual([
      { path: ['cover'], message: 'Field "cover" has to be a media object such as { url: "/uploads/photo.jpg" }' },
      { path: ['gallery'], message: 'Field "gallery" has to be a list of media objects' },
    ])

    expect(issues({ ...post, cover: { alt: 1, width: '800', caption: 'x' }, gallery: [{ url: 'a.png' }, 'b.png'] })).toEqual([
      { path: ['cover'], message: 'Field "cover" needs a "url"' },
      { path: ['cover', 'alt'], message: '"alt" of field "cover" has to be a string' },
      { path: ['cover', 'width'], message: '"width" of field "cover" has to be a number' },
      { path: ['cover', 'caption'], message: 'Field "cover" has no media option "caption"' },
      { path: ['gallery', 1], message: 'Field "gallery" has to be a media object such as { url: "/uploads/photo.jpg" }' },
    ])
  })

  it('checks relations', () => {
    expect(issues({ ...post, author: ['author_1'], related: 'post_2' })).toEqual([
      { path: ['author'], message: 'Field "author" has to hold ids of "author" entries' },
      { path: ['related'], message: 'Field "related" has to be a list of "post" entry ids' },
    ])

    expect(issues({ ...post, related: ['post_2', 3] })).toEqual([
      { path: ['related', 1], message: 'Field "related" has to hold ids of "post" entries' },
    ])
  })

  it('checks blocks', () => {
    expect(issues({ ...post, blocks: { collection: 'hero', id: 'hero_1' } })).toEqual([
      { path: ['blocks'], message: 'Field "blocks" has to be a list of blocks' },
    ])

    expect(issues({
      ...post,
      blocks: [
        'hero_1',
        { collection: 'author', id: 'author_1' },
        { id: 'hero_1' },
        { collection: 'hero', id: 2, title: 'x' },
      ],
    })).toEqual([
      { path: ['blocks', 0], message: 'Field "blocks" has to hold blocks such as { collection: "…", id: "…" }' },
      { path: ['blocks', 1, 'collection'], message: 'Field "blocks" can\'t hold "author" blocks; allowed are hero, post' },
      { path: ['blocks', 2], message: 'A block in field "blocks" needs a "collection"' },
      { path: ['blocks', 3, 'id'], message: 'A block in field "blocks" needs an "id"' },
      { path: ['blocks', 3, 'title'], message: 'A block in field "blocks" has no option "title"' },
    ])
  })

  it('treats translated fields as plain values when the schema has no locales', () => {
    const plain = { collections: { note: { fields: { text: { type: 'text', translate: true } } } } } as ForgePressSchema

    expect(validateEntry(plain, 'note', { ...post, title: undefined, body: undefined, author: undefined, text: 'Hi' })).toEqual([])
  })
})
