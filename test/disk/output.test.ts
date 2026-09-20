import type { OutputIndex } from '../../src/output/types'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveConfig } from '../../src/config/resolve'
import { buildOutput, writeOutput } from '../../src/disk/output'
import { ContentError } from '../../src/files/issues'

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-output-test', import.meta.url))
const out = join(scratch, 'public/content')

const schema = `import type { ForgePressSchema } from 'forgepress'

export default {
  locales: ['en', 'de'],
  collections: {
    author: {
      fields: {
        name: { type: 'text', index: true },
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

function entry(collection: string, id: string, fields: string[], status = 'published'): string {
  return [
    'import type { ForgePressEntry } from \'forgepress\'',
    '',
    'export default {',
    `  id: '${id}',`,
    `  status: '${status}',`,
    '  createdAt: \'2024-01-01T00:00:00Z\',',
    '  updatedAt: \'2024-01-01T00:00:00Z\',',
    ...fields.map(field => `  ${field}`),
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

function site(extra: Record<string, string> = {}): string {
  return project({
    '.forgepress/schema.ts': schema,
    '.forgepress/content/author/author_1.ts': entry('author', 'author_1', ['name: \'Alice\',']),
    '.forgepress/content/author/author_2.ts': entry('author', 'author_2', ['name: \'Bob\','], 'unpublished'),
    '.forgepress/content/blog-post/post_1.ts': entry('blogPost', 'post_1', ['title: { en: \'Hello\', de: \'Hallo\' },', 'author: \'author_1\',']),
    ...extra,
  })
}

function written(): string[] {
  return readdirSync(out, { recursive: true, withFileTypes: true })
    .filter(item => item.isFile())
    .map(item => join(item.parentPath, item.name).slice(out.length + 1))
    .sort()
}

function hashless(paths: string[]): string[] {
  return paths.map(path => path.replace(/\.[\da-f]{8}\.json$/, ''))
}

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('buildOutput', () => {
  it('writes the published content to public/content with the commit', async () => {
    const root = site()
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()

    expect(await buildOutput(root, resolveConfig())).toEqual({ dir: 'public/content', files: 7, commit: head, issues: [], schema: expect.objectContaining({ collections: expect.any(Object) }) })
    expect(hashless(written())).toEqual([
      'author/author_1',
      'author/index',
      'blog-post/de/index',
      'blog-post/de/post_1',
      'blog-post/en/index',
      'blog-post/en/post_1',
      'index.json',
    ])

    const index = JSON.parse(readFileSync(join(out, 'index.json'), 'utf8')) as OutputIndex

    expect(index.commit).toBe(head)
    expect(index.dev).toBeUndefined()
  })

  it('leaves out the commit and marks the output in development', async () => {
    const root = site()

    expect((await buildOutput(root, resolveConfig(), { dev: true })).commit).toBeNull()
    expect(JSON.parse(readFileSync(join(out, 'index.json'), 'utf8'))).toMatchObject({ commit: null, dev: true })
  })

  it('writes what it can in development and hands over the problems', async () => {
    const root = site({
      '.forgepress/content/blog-post/post_2.ts': entry('blogPost', 'post_2', ['title: { en: \'Hi\', de: \'Hallo\' },', 'author: \'author_2\',']),
      '.forgepress/content/blog-post/post_3.ts': 'export default { id: post_3 }\n',
    })

    const result = await buildOutput(root, resolveConfig(), { dev: true })

    expect(result.issues.map(issue => `${issue.file}:${issue.line} ${issue.message}`)).toEqual([
      '.forgepress/content/blog-post/post_2.ts:9 Field "author" references author/author_2, which is unpublished; publish it or remove the reference',
      '.forgepress/content/blog-post/post_3.ts:1 `post_3` is not a literal value; variables, calls and expressions are not allowed',
    ])
    expect(hashless(written()).filter(path => path.startsWith('blog-post/en/'))).toEqual(['blog-post/en/index', 'blog-post/en/post_1', 'blog-post/en/post_2'])
  })

  it('writes nothing in development either while the schema is broken', async () => {
    const root = site({ '.forgepress/schema.ts': schema.replace('type: \'collection\'', 'type: \'link\'') })

    await expect(buildOutput(root, resolveConfig(), { dev: true })).rejects.toBeInstanceOf(ContentError)
    expect(existsSync(out)).toBe(false)
  })

  it('writes into the configured folder', async () => {
    const root = site()

    expect((await buildOutput(root, resolveConfig({ output: { dir: 'dist/data' } }))).dir).toBe('dist/data')
    expect(existsSync(join(root, 'dist/data/index.json'))).toBe(true)
    expect(existsSync(out)).toBe(false)
  })

  it('writes nothing while the content has problems', async () => {
    const root = site({ '.forgepress/content/blog-post/post_2.ts': entry('blogPost', 'post_2', ['title: { en: \'Hi\', de: \'Hallo\' },', 'author: \'author_2\',']) })
    const failure = await buildOutput(root, resolveConfig()).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ContentError)
    expect((failure as ContentError).issues.map(issue => issue.message)).toEqual(['Field "author" references author/author_2, which is unpublished; publish it or remove the reference'])
    expect(existsSync(out)).toBe(false)
  })

  it('refuses a folder outside the project or the project itself', async () => {
    const root = site()

    for (const dir of ['..', '../elsewhere', '.', ''])
      await expect(buildOutput(root, resolveConfig({ output: { dir } }))).rejects.toThrow('[forgepress] the output folder has to be inside the project')
  })

  it('removes output files that are no longer part of the content, and nothing else', async () => {
    const root = site({
      'public/content/author/author_1.00000000.json': '{}',
      'public/content/page/en/page_1.12345678.json': '{}',
      'public/content/page/en/index.87654321.json': '{}',
      'public/content/author/notes.md': 'mine',
      'public/content/settings.12345678.json': '{}',
      'public/content/data/export.json': '{}',
    })

    await buildOutput(root, resolveConfig())

    expect(existsSync(join(out, 'author/author_1.00000000.json'))).toBe(false)
    expect(existsSync(join(out, 'page'))).toBe(false)
    expect(hashless(written())).toEqual([
      'author/author_1',
      'author/index',
      'author/notes.md',
      'blog-post/de/index',
      'blog-post/de/post_1',
      'blog-post/en/index',
      'blog-post/en/post_1',
      'data/export.json',
      'index.json',
      'settings',
    ])
  })

  it('leaves files alone that already hold their content', async () => {
    const root = site()

    await buildOutput(root, resolveConfig())

    const file = written().find(path => path.startsWith('author/author_1.'))!
    const past = new Date('2020-01-01T00:00:00Z')

    utimesSync(join(out, file), past, past)
    await buildOutput(root, resolveConfig())

    expect(statSync(join(out, file)).mtime.toISOString()).toBe(past.toISOString())
  })
})

describe('writeOutput', () => {
  it('writes the root index only after every other file', async () => {
    rmSync(scratch, { recursive: true, force: true })
    mkdirSync(join(out, 'author'), { recursive: true })
    writeFileSync(join(out, 'blocked'), 'a file where a folder is needed')

    await expect(writeOutput(out, [
      { path: 'author/author_1.1234abcd.json', text: '{}' },
      { path: 'blocked/post_1.1234abcd.json', text: '{}' },
      { path: 'index.json', text: '{}' },
    ])).rejects.toThrow()

    expect(existsSync(join(out, 'index.json'))).toBe(false)
  })

  it('wants the root index last', async () => {
    await expect(writeOutput(out, [{ path: 'index.json', text: '{}' }, { path: 'author/index.1234abcd.json', text: '{}' }]))
      .rejects
      .toThrow('[forgepress] the content output has to end with index.json')
  })
})
