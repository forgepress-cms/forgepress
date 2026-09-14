import type { ContentRow } from '../../src/types/entry'
import type { ForgePressSchema } from '../../src/types/schema'
import { describe, expect, it } from 'vitest'
import { entryReferences, validateReferences } from '../../src/entries/references'

const schema = {
  locales: ['en', 'de'],
  collections: {
    page: {
      fields: {
        author: { type: 'relation', collection: 'author', optional: true },
        editors: { type: 'relation', collection: 'author', multiple: true, optional: true },
        blocks: { type: 'dynamic', collections: ['hero'], optional: true },
        links: { type: 'relation', collection: 'page', multiple: true, translate: true, optional: true },
      },
    },
    author: { fields: {} },
    hero: { fields: {} },
  },
} as const satisfies ForgePressSchema

function entry(id: string, fields: Record<string, unknown> = {}, status: ContentRow['status'] = 'published'): ContentRow {
  return { id, status, createdAt: '2024-01-01', updatedAt: '2024-01-01', ...fields }
}

describe('validateReferences', () => {
  it('accepts references to published entries', () => {
    expect(validateReferences(schema, {
      page: {
        page_1: entry('page_1', {
          author: 'author_1',
          editors: ['author_1'],
          blocks: [{ collection: 'hero', id: 'hero_1' }],
          links: { en: ['page_1'] },
        }),
      },
      author: { author_1: entry('author_1') },
      hero: { hero_1: entry('hero_1') },
    })).toEqual([])
  })

  it('reports references to entries that do not exist', () => {
    expect(validateReferences(schema, {
      page: {
        page_1: entry('page_1', {
          author: 'author_2',
          editors: ['author_1', 'author_3'],
          blocks: [{ collection: 'hero', id: 'hero_9' }],
          links: { de: ['page_2'] },
        }),
      },
      author: { author_1: entry('author_1') },
    })).toEqual([
      { collection: 'page', id: 'page_1', path: ['author'], message: 'Field "author" references author/author_2, which doesn\'t exist' },
      { collection: 'page', id: 'page_1', path: ['editors', 1], message: 'Field "editors" references author/author_3, which doesn\'t exist' },
      { collection: 'page', id: 'page_1', path: ['blocks', 0], message: 'Field "blocks" references hero/hero_9, which doesn\'t exist' },
      { collection: 'page', id: 'page_1', path: ['links', 'de', 0], message: 'Field "links" references page/page_2, which doesn\'t exist' },
    ])
  })

  it('reports published entries that reference unpublished ones', () => {
    expect(validateReferences(schema, {
      page: {
        page_1: entry('page_1', { author: 'author_1', blocks: [{ collection: 'hero', id: 'hero_1' }] }),
      },
      author: { author_1: entry('author_1', {}, 'unpublished') },
      hero: { hero_1: entry('hero_1', {}, 'unpublished') },
    })).toEqual([
      { collection: 'page', id: 'page_1', path: ['author'], message: 'Field "author" references author/author_1, which is unpublished; publish it or remove the reference' },
      { collection: 'page', id: 'page_1', path: ['blocks', 0], message: 'Field "blocks" references hero/hero_1, which is unpublished; publish it or remove the reference' },
    ])
  })

  it('lets unpublished entries reference anything that exists', () => {
    expect(validateReferences(schema, {
      page: { page_1: entry('page_1', { author: 'author_1' }, 'unpublished') },
      author: { author_1: entry('author_1', {}, 'unpublished') },
    })).toEqual([])
  })

  it('leaves malformed values to the entry validation', () => {
    expect(validateReferences(schema, {
      page: {
        page_1: entry('page_1', {
          author: ['author_1'],
          editors: 'author_1',
          blocks: [{ collection: 'author', id: 'author_9' }, { id: 'hero_1' }, 'hero_1'],
          links: ['page_9'],
        }),
      },
      unknown: { thing_1: entry('thing_1', { author: 'nobody' }) },
    })).toEqual([])
  })
})

describe('entryReferences', () => {
  it('lists every entry an entry points at, in every locale', () => {
    expect(entryReferences(schema, 'page', entry('page_1', {
      author: 'author_1',
      editors: ['author_2'],
      blocks: [{ collection: 'hero', id: 'hero_1' }, { collection: 'page', id: 'page_9' }],
      links: { en: ['page_2'], de: ['page_3'] },
    }))).toEqual([
      { path: ['author'], collection: 'author', id: 'author_1' },
      { path: ['editors', 0], collection: 'author', id: 'author_2' },
      { path: ['blocks', 0], collection: 'hero', id: 'hero_1' },
      { path: ['links', 'en', 0], collection: 'page', id: 'page_2' },
      { path: ['links', 'de', 0], collection: 'page', id: 'page_3' },
    ])
  })

  it('finds nothing in a collection the schema does not have', () => {
    expect(entryReferences(schema, 'missing', entry('missing_1', { author: 'author_1' }))).toEqual([])
  })
})
