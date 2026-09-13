import type { ContentRow } from '../src/types/content/reader'
import type { ForgePressSchema } from '../src/types/core/schema'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { serializeEntry, serializeSchema } from '../src/content/serialize'

const schema = {
  locales: ['en', 'de'],
  collections: {
    blogPost: {
      label: 'Blog Post',
      fields: {
        title: { type: 'text', label: 'Title', translate: true },
        content: { type: 'dynamic', collections: ['hero', 'textBlock'] },
      },
    },
  },
} as const satisfies ForgePressSchema

describe('serializeSchema', () => {
  it('writes a schema module in project style', () => {
    expect(serializeSchema(schema)).toBe(`import { defineForgePressSchema } from 'forgepress'

export default defineForgePressSchema({
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
          type: 'dynamic',
          collections: ['hero', 'textBlock'],
        },
      },
    },
  },
})
`)
  })

  it('honours the content config', () => {
    expect(serializeSchema({ collections: {} }, { indent: 4, semi: true }))
      .toContain('export default defineForgePressSchema({\n    collections: {},\n});')
  })
})

describe('serializeEntry', () => {
  const row: ContentRow = {
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
    const shuffled: ContentRow = {
      title: 'Late',
      updatedAt: 'u',
      id: 'a',
      createdAt: 'c',
      status: 'unpublished',
    } as ContentRow

    const keys = [...serializeEntry('post', shuffled).matchAll(/^ {2}(\w+):/gm)].map(match => match[1])

    expect(keys).toEqual(['id', 'status', 'createdAt', 'updatedAt', 'title'])
  })

  it('writes a list of media objects one per entry', () => {
    const entry: ContentRow = {
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
    const entry: ContentRow = { id: 'a', status: 'unpublished', createdAt: '', updatedAt: '', body: 'it\'s\nfine' }

    expect(serializeEntry('page', entry)).toContain('body: \'it\\\'s\\nfine\',')
  })

  it('quotes keys that are not identifiers', () => {
    const entry: ContentRow = { 'id': 'a', 'status': 'unpublished', 'createdAt': '', 'updatedAt': '', 'meta-data': 1 }

    expect(serializeEntry('page', entry)).toContain('\'meta-data\': 1,')
  })
})

describe('string escaping', () => {
  const scratch = fileURLToPath(new URL('../node_modules/.forgepress-test', import.meta.url))

  mkdirSync(scratch, { recursive: true })
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  let count = 0

  async function roundTrip(fields: Record<string, unknown>): Promise<Record<string, unknown>> {
    const row = { id: 'a', status: 'unpublished', createdAt: '', updatedAt: '', ...fields } as ContentRow
    const file = join(scratch, `entry-${count += 1}.ts`)

    writeFileSync(file, serializeEntry('post', row).replace(' from \'forgepress\'', ' from \'../../src/index\''))

    return (await import(file) as { default: Record<string, unknown> }).default
  }

  it('emits an importable module for carriage returns', async () => {
    const value = 'line1\r\nline2'

    expect((await roundTrip({ value })).value).toBe(value)
  })

  it('emits an importable module for unicode line separators', async () => {
    const value = 'a\u2028b\u2029c'

    expect((await roundTrip({ value })).value).toBe(value)
  })

  it('emits an importable module for control characters', async () => {
    const value = ['\u0000', '\u0007', '\u001B', '\u007F', '\u009F', '\t'].join('|')

    expect((await roundTrip({ value })).value).toBe(value)
  })

  it('keeps quotes and backslashes intact', async () => {
    const value = 'it\'s a \\ backslash'

    expect((await roundTrip({ value })).value).toBe(value)
  })

  it('escapes hostile object keys', async () => {
    const key = 'we\'ird\nkey'

    expect((await roundTrip({ [key]: 'value' }))[key]).toBe('value')
  })

  it('preserves the entry status as a literal', async () => {
    expect((await roundTrip({})).status).toBe('unpublished')
  })
})
