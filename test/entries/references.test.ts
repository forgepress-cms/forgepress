import type { Entry } from '../../src/entries/types'
import type { ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { entryReferences, unpublishedReferences, validateReferences } from '../../src/entries/references'

const schema = {
  locales: ['en', 'de'],
  collections: {
    page: {
      fields: {
        author: { type: 'collection', collections: ['author'], optional: true },
        editors: { type: 'collection', collections: ['author'], multiple: true, optional: true },
        blocks: { type: 'collection', collections: ['hero', 'page'], multiple: true, optional: true },
        links: { type: 'collection', collections: ['page'], multiple: true, translate: true, optional: true },
      },
    },
    author: { fields: {} },
    hero: { fields: {} },
  },
} as const satisfies ForgePressSchema

function entry(id: string, fields: Record<string, unknown> = {}, status: Entry['status'] = 'published'): Entry {
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
      blocks: [{ collection: 'hero', id: 'hero_1' }, { collection: 'author', id: 'author_9' }],
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

describe('unpublishedReferences', () => {
  const stored: Record<string, Entry> = {
    'author/author_1': entry('author_1', {}, 'unpublished'),
    'author/author_2': entry('author_2'),
    'hero/hero_1': entry('hero_1', {}, 'unpublished'),
    'page/page_2': entry('page_2', { author: 'author_1', links: { de: ['page_3'] } }, 'unpublished'),
    'page/page_3': entry('page_3', { editors: ['author_9'] }, 'unpublished'),
  }

  const find = (collection: string, id: string): Entry | undefined => stored[`${collection}/${id}`]

  it('finds the unpublished entries a published one links to, and what those link to', () => {
    expect(unpublishedReferences(schema, [
      { collection: 'page', entry: entry('page_1', { author: 'author_2', blocks: [{ collection: 'hero', id: 'hero_1' }], links: { en: ['page_2', 'page_9'] } }) },
    ], find)).toEqual([
      { collection: 'hero', entry: stored['hero/hero_1'] },
      { collection: 'page', entry: stored['page/page_2'] },
      { collection: 'author', entry: stored['author/author_1'] },
      { collection: 'page', entry: stored['page/page_3'] },
    ])
  })

  it('judges the entries being saved by their new version', () => {
    const block = entry('hero_1', {}, 'unpublished')
    const author = entry('author_2', {}, 'unpublished')

    expect(unpublishedReferences(schema, [
      { collection: 'hero', entry: entry('hero_1') },
      { collection: 'page', entry: entry('page_1', { author: 'author_2', editors: ['author_2'], blocks: [{ collection: 'hero', id: 'hero_1' }] }) },
      { collection: 'author', entry: author },
    ], find)).toEqual([{ collection: 'author', entry: author }])

    expect(unpublishedReferences(schema, [
      { collection: 'hero', entry: block },
      { collection: 'page', entry: entry('page_1', { blocks: [{ collection: 'hero', id: 'hero_1' }] }) },
    ], find)).toEqual([{ collection: 'hero', entry: block }])
  })

  it('finds nothing when the entries being saved are unpublished', () => {
    expect(unpublishedReferences(schema, [
      { collection: 'page', entry: entry('page_1', { author: 'author_1' }, 'unpublished') },
      { collection: 'hero', entry: entry('hero_1', {}, 'unpublished') },
    ], find)).toEqual([])
  })
})
