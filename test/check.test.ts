import type { UnpluginContextMeta } from 'unplugin'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { checkContent } from '../src/disk/check'
import { formatIssue } from '../src/files/issues'
import { unpluginFactory } from '../src/unplugin'

const scratch = fileURLToPath(new URL('../node_modules/.forgepress-check-test', import.meta.url))
const fixture = fileURLToPath(new URL('./fixtures/project', import.meta.url))

const schema = `import type { ForgePressSchema } from 'forgepress'

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
`

function entry(collection: string, lines: string[]): string {
  return [
    'import type { ForgePressEntry } from \'forgepress\'',
    '',
    'export default {',
    ...lines.map(line => `  ${line}`),
    `} satisfies ForgePressEntry<'${collection}'>`,
    '',
  ].join('\n')
}

function project(files: Record<string, string>): string {
  rmSync(scratch, { recursive: true, force: true })

  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(scratch, path, '..'), { recursive: true })
    writeFileSync(join(scratch, path), text)
  }

  return scratch
}

async function problems(files: Record<string, string>): Promise<string[]> {
  return (await checkContent(project(files))).map(formatIssue)
}

const alice = entry('author', ['id: \'author_1\',', 'status: \'published\',', 'createdAt: \'2024-01-01T00:00:00Z\',', 'updatedAt: \'2024-01-01T00:00:00Z\',', 'name: \'Alice\','])

afterEach(() => rmSync(scratch, { recursive: true, force: true }))

describe('checkContent', () => {
  it('finds nothing wrong with valid content', async () => {
    expect(await checkContent(fixture)).toEqual([])
  })

  it('reports every problem in every file with its position', async () => {
    expect(await problems({
      '.forgepress/schema.ts': schema,
      '.forgepress/content/author/author_1.ts': alice,
      '.forgepress/content/author/author_2.ts': entry('author', ['id: \'author_9\',', 'status: \'unpublished\',', 'createdAt: \'2024-01-01\',', 'updatedAt: \'2024-01-01\',', 'name: \'Bob\',']),
      '.forgepress/content/blog-post/post_1.ts': entry('blogPost', [
        'id: \'post_1\',',
        'status: \'published\',',
        'createdAt: \'2024-02-30\',',
        'updatedAt: \'2024-01-01T00:00:00Z\',',
        'title: { en: \'Hello\', fr: \'Bonjour\' },',
        'author: \'author_2\',',
        'colour: \'red\',',
      ]),
      '.forgepress/content/blog-post/post_2.ts': entry('blogPost', [
        'id: \'post_2\',',
        'status: \'published\',',
        'createdAt: \'2024-01-01\',',
        'updatedAt: \'2024-01-01\',',
        'title: { en: \'Hi\', de: \'Hallo\' },',
        'author: \'author_3\',',
      ]),
      '.forgepress/content/blog-post/post_3.ts': 'export default { id: someId }\n',
      '.forgepress/content/page/page_1.ts': entry('page', ['id: \'page_1\',']),
    })).toEqual([
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

  it('stops at schema problems, since entries cannot be checked against a broken schema', async () => {
    expect(await problems({
      '.forgepress/schema.ts': schema.replace('collection: \'author\'', 'collection: \'autor\''),
      '.forgepress/content/author/author_1.ts': 'export default nonsense\n',
    })).toEqual([
      '.forgepress/schema.ts:14:37 Field "blogPost.author" references unknown collection "autor"',
    ])
  })

  it('reports a schema that cannot be parsed', async () => {
    expect(await problems({ '.forgepress/schema.ts': 'export default defineSchema({})\n' })).toEqual([
      '.forgepress/schema.ts:1:16 `defineSchema` is not a literal value; variables, calls and expressions are not allowed',
    ])
  })
})

describe('build', () => {
  function plugin(command: 'build' | 'serve') {
    const created = unpluginFactory({ root: scratch }, { framework: 'vite' } as UnpluginContextMeta)
    const instance = Array.isArray(created) ? created[0]! : created

    ;(instance.vite as { configResolved: (config: { command: string, root: string }) => void }).configResolved({ command, root: scratch })

    return instance.buildStart as unknown as () => Promise<void>
  }

  it('fails when the content has problems', async () => {
    project({
      '.forgepress/schema.ts': schema,
      '.forgepress/content/author/author_1.ts': alice.replace('name: \'Alice\',', 'name: 42,'),
    })

    await expect(plugin('build')()).rejects.toThrow('[forgepress] .forgepress/content/author/author_1.ts:8:3 Field "name" has to be a string')
  })

  it('passes with valid content', async () => {
    project({ '.forgepress/schema.ts': schema, '.forgepress/content/author/author_1.ts': alice })

    await expect(plugin('build')()).resolves.toBeUndefined()
  })

  it('does not stop the dev server', async () => {
    project({
      '.forgepress/schema.ts': schema,
      '.forgepress/content/author/author_1.ts': alice.replace('name: \'Alice\',', 'name: 42,'),
    })

    await expect(plugin('serve')()).resolves.toBeUndefined()
  })
})
