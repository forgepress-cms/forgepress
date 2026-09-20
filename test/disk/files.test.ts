import type { UnpluginContextMeta } from 'unplugin'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { diskFiles } from '../../src/disk/files'
import { createFileSource, readContent } from '../../src/files/content'
import { formatIssue } from '../../src/files/issues'
import { defaultPaths } from '../../src/files/paths'
import { unpluginFactory } from '../../src/unplugin'

const fixture = fileURLToPath(new URL('../fixtures/project', import.meta.url))
const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-files-test', import.meta.url))

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
        author: { type: 'collection', collections: ['author'] },
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
  return (await readContent(diskFiles(project(files)), defaultPaths)).issues.map(formatIssue)
}

function source(root: string) {
  return createFileSource(diskFiles(root), defaultPaths)
}

const alice = entry('author', ['id: \'author_1\',', 'status: \'published\',', 'createdAt: \'2024-01-01T00:00:00Z\',', 'updatedAt: \'2024-01-01T00:00:00Z\',', 'name: \'Alice\','])

afterEach(() => rmSync(scratch, { recursive: true, force: true }))

describe('files on disk', () => {
  it('lists every file below a folder, by its path from the project', async () => {
    project({ '.forgepress/content/author/author_1.ts': alice, '.forgepress/content/author/drafts/author_2.ts': alice })

    expect((await diskFiles(scratch).list('.forgepress/content')).sort()).toEqual([
      '.forgepress/content/author/author_1.ts',
      '.forgepress/content/author/drafts/author_2.ts',
    ])
    expect(await diskFiles(scratch).list('.forgepress/missing')).toEqual([])
  })

  it('reads a file as text and nothing for a file that is not there', async () => {
    project({ '.forgepress/content/author/author_1.ts': alice })

    expect(await diskFiles(scratch).read('.forgepress/content/author/author_1.ts')).toBe(alice)
    expect(await diskFiles(scratch).read('.forgepress/schema.ts')).toBeUndefined()
  })
})

describe('reading content from disk', () => {
  it('loads the schema', async () => {
    const found = await source(fixture).schema()

    expect(found.locales).toEqual(['en', 'de'])
    expect(Object.keys(found.collections)).toEqual(['author', 'blogPost'])
    expect(found.collections.blogPost?.fields.author).toEqual({ type: 'collection', label: 'Author', collections: ['author'] })
  })

  it('resolves a collection to its entry files', async () => {
    const rows = await source(fixture).list('blogPost')

    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toEqual({ en: 'Hello', de: 'Hallo' })
  })

  it('treats a collection without an entry directory as empty', async () => {
    expect(await source(fixture).list('missing')).toEqual([])
  })

  it('loads a single entry without reading the collection', async () => {
    expect((await source(fixture).entry('blogPost', 'blog-post-1'))?.author).toBe('author-1')
    expect(await source(fixture).entry('blogPost', 'missing')).toBeUndefined()
    expect(await source(fixture).entry('author', '../../schema')).toBeUndefined()
  })

  it('reads unpublished entries too', async () => {
    expect((await source(fixture).list('author')).map(row => row.id)).toEqual(['author-1', 'author-2'])
    expect((await source(fixture).entry('author', 'author-2'))?.name).toBe('Bob')
  })

  it('refuses to run an entry and points at the expression', async () => {
    project({
      '.forgepress/content/post/post_1.ts': entry('post', ['id: \'post_1\',', 'author: globalThis.process.exit(1),']),
    })

    await expect(source(scratch).list('post'))
      .rejects
      .toThrow('[forgepress] .forgepress/content/post/post_1.ts:5:11 `globalThis` is not a literal value')
  })

  it('reports schema problems with their position', async () => {
    project({ '.forgepress/schema.ts': 'export default { collections: { post: { fields: { author: { type: \'collection\', collections: [\'autor\'] } } } } }\n' })

    await expect(source(scratch).schema())
      .rejects
      .toThrow('[forgepress] .forgepress/schema.ts:1:95 Field "post.author" references unknown collection "autor"')
  })
})

describe('a project without a schema', () => {
  let empty = ''

  beforeAll(() => {
    empty = mkdtempSync(join(tmpdir(), 'forgepress-empty-reader-'))
    writeFileSync(join(empty, 'package.json'), '{}\n')
  })

  afterAll(() => rmSync(empty, { recursive: true, force: true }))

  it('has no collections yet', async () => {
    expect(await source(empty).schema()).toEqual({ collections: {} })
    expect(await source(empty).list('author')).toEqual([])
    expect(await source(empty).entry('author', 'author_1')).toBeUndefined()
  })
})

describe('checking content on disk', () => {
  it('finds nothing wrong with valid content', async () => {
    expect((await readContent(diskFiles(fixture), defaultPaths)).issues).toEqual([])
  })

  it('checks every entry file in the collection folders', async () => {
    expect(await problems({
      '.forgepress/schema.ts': schema,
      '.forgepress/content/author/author_1.ts': alice,
      '.forgepress/content/author/author_2.ts': alice,
      '.forgepress/content/author/notes.md': '# not an entry\n',
      '.forgepress/content/blog-post/post_1.ts': entry('blogPost', [
        'id: \'post_1\',',
        'status: \'published\',',
        'createdAt: \'2024-01-01\',',
        'updatedAt: \'2024-01-01\',',
        'title: { en: \'Hi\', de: \'Hallo\' },',
        'author: \'author_3\',',
      ]),
      '.forgepress/content/page/page_1.ts': entry('page', ['id: \'page_1\',']),
    })).toEqual([
      '.forgepress/content/author/author_2.ts:4:3 "id" is "author_1", but the file is named author_2.ts',
      '.forgepress/content/blog-post/post_1.ts:9:3 Field "author" references author/author_3, which doesn\'t exist',
      '.forgepress/content/page/page_1.ts:3:16 Collection "page" is not in the schema',
    ])
  })

  it('checks a project without a schema as one without collections', async () => {
    expect(await problems({})).toEqual([])
    expect(await problems({ '.forgepress/content/author/author_1.ts': alice })).toEqual([
      '.forgepress/content/author/author_1.ts:3:16 Collection "author" is not in the schema',
    ])
  })

  it('reads the schema from the content folder', async () => {
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
