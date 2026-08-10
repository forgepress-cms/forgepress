import type { ContentRow } from '../src/types/content/reader'
import type { WebenvSchema } from '../src/types/core/schema'
import { describe, expect, it } from 'vitest'
import { createSchemaOverview } from '../src/schema/overview'

const schema = {
  locales: ['en', 'de'],
  components: {
    author: {
      label: 'Author',
      elements: {
        name: { type: 'text', label: 'Name' },
        bio: { type: 'richtext', label: 'Bio', translate: true, optional: true },
        posts: { type: 'relation', label: 'Posts', component: 'post', multiple: true },
      },
    },
    post: {
      elements: {
        title: { type: 'text', label: 'Title', translate: true },
        author: { type: 'relation', label: 'Author', component: 'author' },
        blocks: { type: 'dynamic', label: 'Blocks', components: ['missing'] },
      },
    },
  },
} as const satisfies WebenvSchema

function content(): Record<string, ContentRow[]> {
  return {
    author: [
      { id: 'a1', status: 'published', createdAt: '2024-01-01', updatedAt: '2024-03-01', name: 'Alice', bio: { en: 'Bio' }, posts: ['p1'] },
    ],
    post: [
      { id: 'p1', status: 'draft', createdAt: '2024-01-01', updatedAt: '2024-02-01', title: { en: 'One', de: 'Eins' }, author: 'a1', blocks: [] },
      { id: 'p2', status: 'archived', createdAt: '2024-01-01', updatedAt: '2024-01-05', title: { en: 'Two', de: 'Zwei' }, author: 'ghost', blocks: [] },
    ],
  }
}

describe('createSchemaOverview', () => {
  const overview = createSchemaOverview(schema, content())
  const author = overview.components[0]!
  const post = overview.components[1]!

  it('counts the schema and its content', () => {
    expect(overview.totals).toEqual({ components: 2, elements: 6, rows: 3, relations: 3 })
    expect(overview.locales).toEqual(['en', 'de'])
  })

  it('summarizes a component', () => {
    expect(author.label).toBe('Author')
    expect(author.file).toBe('author.ts')
    expect(author.translated).toBe(1)
    expect(author.optional).toBe(1)
    expect(author.rows).toBe(1)
    expect(author.updatedAt).toBe('2024-03-01')
    expect(post.label).toBe('post')
    expect(post.status).toEqual({ draft: 1, published: 0, archived: 1 })
  })

  it('resolves relations in both directions', () => {
    expect(author.references.map(edge => edge.to)).toEqual(['post'])
    expect(author.referencedBy.map(edge => `${edge.from}.${edge.element}`)).toEqual(['post.author'])
    expect(post.references.map(edge => edge.kind)).toEqual(['relation', 'dynamic'])
  })

  it('reports unknown targets, dangling ids and missing translations', () => {
    const messages = overview.issues.map(issue => `${issue.level} ${issue.component}.${issue.element} ${issue.message}`)

    expect(messages).toContain('error post.blocks references unknown component "missing"')
    expect(messages).toContain('error post.author points at missing author rows: ghost')
    expect(messages).toContain('warning author.bio is untranslated for de')
  })
})
