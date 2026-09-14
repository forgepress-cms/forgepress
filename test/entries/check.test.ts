import type { EntryFile } from '../../src/entries/check'
import { describe, expect, it } from 'vitest'
import { checkFiles, parseContent } from '../../src/entries/check'
import { formatIssue } from '../../src/files/issues'

const schema = {
  path: '.forgepress/schema.ts',
  text: `import type { ForgePressSchema } from 'forgepress'

export default {
  locales: ['en', 'de'],
  collections: {
    author: {
      fields: {
        name: { type: 'text' },
      },
    },
    blogPost: {
      fields: {
        title: { type: 'text', translate: true },
        author: { type: 'relation', collection: 'author' },
      },
    },
  },
} as const satisfies ForgePressSchema
`,
}

function entry(collection: string, id: string, lines: string[], directory = collection): EntryFile {
  return {
    collection,
    id,
    path: `.forgepress/content/${directory}/${id}.ts`,
    text: [
      'import type { ForgePressEntry } from \'forgepress\'',
      '',
      'export default {',
      ...lines.map(line => `  ${line}`),
      `} satisfies ForgePressEntry<'${collection}'>`,
      '',
    ].join('\n'),
  }
}

function meta(id: string, status = 'published'): string[] {
  return [`id: '${id}',`, `status: '${status}',`, 'createdAt: \'2024-01-01T00:00:00Z\',', 'updatedAt: \'2024-01-01T00:00:00Z\',']
}

function problems(entries: EntryFile[], schemaFile = schema): string[] {
  return checkFiles(schemaFile, entries).map(formatIssue)
}

describe('checkFiles', () => {
  it('finds nothing wrong with valid content', () => {
    expect(problems([
      entry('author', 'author_1', [...meta('author_1'), 'name: \'Alice\',']),
      entry('blogPost', 'post_1', [...meta('post_1'), 'title: { en: \'Hello\', de: \'Hallo\' },', 'author: \'author_1\','], 'blog-post'),
    ])).toEqual([])
  })

  it('reports every problem in every file with its position', () => {
    expect(problems([
      entry('author', 'author_1', [...meta('author_1'), 'name: \'Alice\',']),
      entry('author', 'author_2', [...meta('author_9', 'unpublished'), 'name: \'Bob\',']),
      entry('blogPost', 'post_1', [
        'id: \'post_1\',',
        'status: \'published\',',
        'createdAt: \'2024-02-30\',',
        'updatedAt: \'2024-01-01T00:00:00Z\',',
        'title: { en: \'Hello\', fr: \'Bonjour\' },',
        'author: \'author_2\',',
        'colour: \'red\',',
      ], 'blog-post'),
      entry('blogPost', 'post_2', [...meta('post_2'), 'title: { en: \'Hi\', de: \'Hallo\' },', 'author: \'author_3\','], 'blog-post'),
      { collection: 'blogPost', id: 'post_3', path: '.forgepress/content/blog-post/post_3.ts', text: 'export default { id: someId }\n' },
      entry('page', 'page_1', ['id: \'page_1\',']),
    ])).toEqual([
      '.forgepress/content/author/author_2.ts:4:3 "id" is "author_9", but the file is named author_2.ts',
      '.forgepress/content/blog-post/post_1.ts:6:3 "createdAt" has to be an ISO 8601 date such as "2024-01-31T09:30:00Z"',
      '.forgepress/content/blog-post/post_1.ts:8:3 Field "title" is missing its de translation',
      '.forgepress/content/blog-post/post_1.ts:8:25 Field "title" has no locale "fr"; the schema has en, de',
      '.forgepress/content/blog-post/post_1.ts:9:3 Field "author" references author/author_2, which is unpublished; publish it or remove the reference',
      '.forgepress/content/blog-post/post_1.ts:10:3 "colour" is not a field of collection "blogPost"',
      '.forgepress/content/blog-post/post_2.ts:9:3 Field "author" references author/author_3, which doesn\'t exist',
      '.forgepress/content/blog-post/post_3.ts:1:22 `someId` is not a literal value; variables, calls and expressions are not allowed',
      '.forgepress/content/page/page_1.ts:3:16 Collection "page" is not in the schema',
    ])
  })

  it('stops at schema problems, since entries cannot be checked against a broken schema', () => {
    expect(problems(
      [{ collection: 'author', id: 'author_1', path: '.forgepress/content/author/author_1.ts', text: 'export default nonsense\n' }],
      { ...schema, text: schema.text.replace('collection: \'author\'', 'collection: \'autor\'') },
    )).toEqual([
      '.forgepress/schema.ts:14:37 Field "blogPost.author" references unknown collection "autor"',
    ])
  })

  it('reports a schema that cannot be parsed', () => {
    expect(problems([], { ...schema, text: 'export default defineSchema({})\n' })).toEqual([
      '.forgepress/schema.ts:1:16 `defineSchema` is not a literal value; variables, calls and expressions are not allowed',
    ])
  })
})

describe('parseContent', () => {
  it('hands over the schema and the entries it checked', () => {
    const parsed = parseContent(schema, [
      entry('author', 'author_1', [...meta('author_1'), 'name: \'Alice\',']),
      entry('blogPost', 'post_1', [...meta('post_1', 'unpublished'), 'title: { en: \'Hello\', de: \'Hallo\' },', 'author: \'author_1\','], 'blog-post'),
    ])

    expect(parsed.issues).toEqual([])
    expect(Object.keys(parsed.schema!.collections)).toEqual(['author', 'blogPost'])
    expect(parsed.content).toEqual({
      author: { author_1: { id: 'author_1', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', name: 'Alice' } },
      blogPost: { post_1: { id: 'post_1', status: 'unpublished', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', title: { en: 'Hello', de: 'Hallo' }, author: 'author_1' } },
    })
  })

  it('has no schema when the schema has problems', () => {
    const parsed = parseContent({ ...schema, text: schema.text.replace('collection: \'author\'', 'collection: \'autor\'') }, [])

    expect(parsed.schema).toBeUndefined()
    expect(parsed.issues).toHaveLength(1)
  })
})
