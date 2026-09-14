import type { Entry } from '../../src/types/entry'
import type { ForgePressSchema } from '../../src/types/schema'
import { describe, expect, it } from 'vitest'
import { indexedFields, isLocalized, toOutputEntry } from '../../src/output/entry'

const schema = {
  locales: ['en', 'de'],
  collections: {
    author: {
      fields: {
        name: { type: 'text', index: true },
        portrait: { type: 'image', optional: true },
        age: { type: 'number', optional: true, index: false },
        posts: { type: 'relation', collection: 'blogPost', multiple: true, optional: true },
      },
    },
    blogPost: {
      fields: {
        title: { type: 'text', translate: true, index: true },
        summary: { type: 'text', translate: true, optional: true },
        body: { type: 'richtext', translate: true },
        author: { type: 'relation', collection: 'author', index: true },
        blocks: { type: 'dynamic', collections: ['hero'], optional: true },
      },
    },
    hero: { fields: {} },
  },
} as const satisfies ForgePressSchema

const meta = { status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' } as const

describe('output entries', () => {
  it('keeps the metadata but not the status, and relations name their collection', () => {
    const author: Entry = { id: 'author_1', ...meta, name: 'Alice', portrait: { url: '/uploads/alice.png', width: 10 }, posts: ['post_1', 'post_2'] }

    expect(toOutputEntry(schema, 'author', author)).toEqual({
      id: 'author_1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      name: 'Alice',
      portrait: { url: '/uploads/alice.png', width: 10 },
      posts: [{ collection: 'blogPost', id: 'post_1' }, { collection: 'blogPost', id: 'post_2' }],
    })
  })

  it('reduces translated fields to one locale and leaves out missing translations', () => {
    const post: Entry = {
      id: 'post_1',
      ...meta,
      title: { en: 'Hello', de: 'Hallo' },
      summary: { en: 'Short' },
      body: { en: '# Hello', de: '# Hallo' },
      author: 'author_1',
      blocks: [{ collection: 'hero', id: 'hero_1' }],
    }

    expect(toOutputEntry(schema, 'blogPost', post, 'de')).toEqual({
      id: 'post_1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      title: 'Hallo',
      body: '# Hallo',
      author: { collection: 'author', id: 'author_1' },
      blocks: [{ collection: 'hero', id: 'hero_1' }],
    })

    expect(toOutputEntry(schema, 'blogPost', post, 'en')).toMatchObject({ title: 'Hello', summary: 'Short' })
  })

  it('writes fields in schema order', () => {
    const post: Entry = { id: 'post_1', ...meta, author: 'author_1', body: { en: 'b', de: 'b' }, title: { en: 't', de: 't' } }

    expect(Object.keys(toOutputEntry(schema, 'blogPost', post, 'en'))).toEqual(['id', 'createdAt', 'updatedAt', 'title', 'body', 'author'])
  })

  it('knows which collections are translated and which fields are indexed', () => {
    expect(isLocalized(schema, 'author')).toBe(false)
    expect(isLocalized(schema, 'blogPost')).toBe(true)
    expect(isLocalized({ collections: { post: { fields: { title: { type: 'text' } } } } }, 'post')).toBe(false)

    expect(indexedFields(schema, 'author')).toEqual(['name'])
    expect(indexedFields(schema, 'blogPost')).toEqual(['title', 'author'])
    expect(indexedFields(schema, 'hero')).toEqual([])
  })
})
