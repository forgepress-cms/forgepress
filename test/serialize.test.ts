import type { ContentRow } from '../src/types/content/reader'
import type { WebenvSchema } from '../src/types/core/schema'
import { describe, expect, it } from 'vitest'
import { serializeContent, serializeSchema } from '../src/content/serialize'

const schema = {
  locales: ['en', 'de'],
  components: {
    blogPost: {
      label: 'Blog Post',
      elements: {
        title: { type: 'text', label: 'Title', translate: true },
        content: { type: 'dynamic', components: ['hero', 'textBlock'] },
      },
    },
  },
} as const satisfies WebenvSchema

describe('serializeSchema', () => {
  it('writes a schema module in project style', () => {
    expect(serializeSchema(schema)).toBe(`import { defineWebenvSchema } from 'webenv'

export default defineWebenvSchema({
  locales: ['en', 'de'],
  components: {
    blogPost: {
      label: 'Blog Post',
      elements: {
        title: {
          type: 'text',
          label: 'Title',
          translate: true,
        },
        content: {
          type: 'dynamic',
          components: ['hero', 'textBlock'],
        },
      },
    },
  },
})
`)
  })

  it('honours the content config', () => {
    expect(serializeSchema({ components: {} }, { indent: 4, semi: true }))
      .toContain('export default defineWebenvSchema({\n    components: {},\n});')
  })
})

describe('serializeContent', () => {
  const rows: ContentRow[] = [{
    id: 'blog-post-1',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    title: { en: 'Hello', de: 'Hallo' },
    tags: [],
    draft: undefined,
  }]

  it('writes a content module typed by component', () => {
    expect(serializeContent('blogPost', rows)).toBe(`import { defineWebenvContent } from 'webenv'

export default defineWebenvContent<'blogPost'>([
  {
    id: 'blog-post-1',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    title: {
      en: 'Hello',
      de: 'Hallo',
    },
    tags: [],
  },
])
`)
  })

  it('escapes quotes and newlines', () => {
    const row: ContentRow = { id: 'a', status: 'draft', createdAt: '', updatedAt: '', body: 'it\'s\nfine' }

    expect(serializeContent('page', [row])).toContain('body: \'it\\\'s\\nfine\',')
  })

  it('quotes keys that are not identifiers', () => {
    const row: ContentRow = { 'id': 'a', 'status': 'draft', 'createdAt': '', 'updatedAt': '', 'meta-data': 1 }

    expect(serializeContent('page', [row])).toContain('\'meta-data\': 1,')
  })
})
