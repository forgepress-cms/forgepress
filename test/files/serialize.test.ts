import type { Entry } from '../../src/entries/types'
import type { ForgePressSchema } from '../../src/schema/types'
import { describe, expect, it } from 'vitest'
import { parseEntry, parseSchema } from '../../src/files/parse'
import { serializeEntry, serializeSchema } from '../../src/files/serialize'

const schema = {
  locales: ['en', 'de'],
  collections: {
    blogPost: {
      label: 'Blog Post',
      fields: {
        title: { type: 'text', label: 'Title', translate: true },
        content: { type: 'collection', collections: ['hero', 'textBlock'], multiple: true },
      },
    },
  },
} as const satisfies ForgePressSchema

describe('serializeSchema', () => {
  it('writes a schema module in project style', () => {
    expect(serializeSchema(schema)).toBe(`import type { ForgePressSchema } from 'forgepress'

export default {
  locales: ['en', 'de'],
  collections: {
    blogPost: {
      label: 'Blog Post',
      fields: {
        title: {
          type: 'text',
          label: 'Title',
          translate: true,
        },
        content: {
          type: 'collection',
          collections: ['hero', 'textBlock'],
          multiple: true,
        },
      },
    },
  },
} as const satisfies ForgePressSchema
`)
  })

  it('honours the content config', () => {
    expect(serializeSchema({ collections: {} }, { indent: 4, semi: true }))
      .toContain('export default {\n    collections: {},\n} as const satisfies ForgePressSchema;')
  })

  it('writes a schema the parser reads back', () => {
    const complete = { ...schema, collections: { ...schema.collections, hero: { fields: {} }, textBlock: { fields: {} } } }

    expect(parseSchema(serializeSchema(complete), 'schema.ts')).toEqual(complete)
  })
})

describe('serializeEntry', () => {
  const row: Entry = {
    id: 'blog-post-1',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    title: { en: 'Hello', de: 'Hallo' },
    tags: [],
    draft: undefined,
  }

  it('writes one module per entry as a single default export', () => {
    expect(serializeEntry('blogPost', row)).toBe(`import type { ForgePressEntry } from 'forgepress'

export default {
  id: 'blog-post-1',
  status: 'published',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  title: {
    en: 'Hello',
    de: 'Hallo',
  },
  tags: [],
} satisfies ForgePressEntry<'blogPost'>
`)
  })

  it('writes the metadata keys first regardless of row order', () => {
    const shuffled: Entry = {
      title: 'Late',
      updatedAt: 'u',
      id: 'a',
      createdAt: 'c',
      status: 'unpublished',
    } as Entry

    const keys = [...serializeEntry('post', shuffled).matchAll(/^ {2}(\w+):/gm)].map(match => match[1])

    expect(keys).toEqual(['id', 'status', 'createdAt', 'updatedAt', 'title'])
  })

  it('writes a list of media objects one per entry', () => {
    const entry: Entry = {
      id: 'a',
      status: 'unpublished',
      createdAt: '',
      updatedAt: '',
      gallery: [{ url: '/uploads/a.png', width: 800, height: 600 }, { url: '/uploads/b.png' }],
    }

    expect(serializeEntry('page', entry)).toContain(`  gallery: [
    {
      url: '/uploads/a.png',
      width: 800,
      height: 600,
    },
    {
      url: '/uploads/b.png',
    },
  ],`)
  })

  it('escapes quotes and newlines', () => {
    const entry: Entry = { id: 'a', status: 'unpublished', createdAt: '', updatedAt: '', body: 'it\'s\nfine' }

    expect(serializeEntry('page', entry)).toContain('body: \'it\\\'s\\nfine\',')
  })

  it('quotes keys that are not identifiers', () => {
    const entry: Entry = { 'id': 'a', 'status': 'unpublished', 'createdAt': '', 'updatedAt': '', 'meta-data': 1 }

    expect(serializeEntry('page', entry)).toContain('\'meta-data\': 1,')
  })

  it('leaves out values an entry file cannot hold', () => {
    const entry = { id: 'a', status: 'unpublished', createdAt: '', updatedAt: '', gone: null, count: Number.NaN, list: [1, null, undefined, Infinity, 2] } as Entry

    expect(parseEntry(serializeEntry('page', entry), 'a.ts')).toEqual({ id: 'a', status: 'unpublished', createdAt: '', updatedAt: '', list: [1, 2] })
  })
})

describe('string escaping', () => {
  function roundTrip(fields: Record<string, unknown>): Record<string, unknown> {
    const row = { id: 'a', status: 'unpublished', createdAt: '', updatedAt: '', ...fields } as Entry

    return parseEntry(serializeEntry('post', row), 'post.ts')
  }

  it('reads carriage returns back', () => {
    const value = 'line1\r\nline2'

    expect(roundTrip({ value }).value).toBe(value)
  })

  it('reads unicode line separators back', () => {
    const value = 'a\u2028b\u2029c'

    expect(roundTrip({ value }).value).toBe(value)
  })

  it('reads control characters back', () => {
    const value = ['\u0000', '\u0007', '\u001B', '\u007F', '\u009F', '\t'].join('|')

    expect(roundTrip({ value }).value).toBe(value)
  })

  it('keeps quotes, backslashes and emoji intact', () => {
    const value = 'it\'s a \\ backslash, "quoted" 😀'

    expect(roundTrip({ value }).value).toBe(value)
  })

  it('escapes hostile object keys', () => {
    const key = 'we\'ird\nkey'

    expect(roundTrip({ [key]: 'value' })[key]).toBe('value')
  })

  it('preserves the entry status as a literal', () => {
    expect(roundTrip({}).status).toBe('unpublished')
  })
})
