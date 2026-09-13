import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSource } from '../src/disk/source'
import { defaultPaths } from '../src/files/paths'

const root = fileURLToPath(new URL('./fixtures/project', import.meta.url))

describe('node reader', () => {
  it('loads the schema from disk', async () => {
    const schema = await createSource(root).schema()

    expect(schema.locales).toEqual(['en', 'de'])
    expect(Object.keys(schema.collections)).toEqual(['author', 'blogPost'])
    expect(schema.collections.blogPost?.fields.author).toEqual({ type: 'relation', label: 'Author', collection: 'author' })
  })

  it('resolves a collection to its entry files', async () => {
    const rows = await createSource(root).list('blogPost')

    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toEqual({ en: 'Hello', de: 'Hallo' })
  })

  it('treats a collection without an entry directory as empty', async () => {
    expect(await createSource(root).list('missing')).toEqual([])
  })

  it('walks up to the nearest .forgepress directory', async () => {
    expect(await createSource(join(root, '.forgepress', 'content')).list('author')).toHaveLength(1)
  })

  it('reads each collection once', async () => {
    const source = createSource(root)

    expect(await source.list('author')).toBe(await source.list('author'))
  })

  it('loads a single entry without reading the collection', async () => {
    const source = createSource(root)

    expect((await source.entry('blogPost', 'blog-post-1'))?.author).toBe('author-1')
    expect(await source.entry('blogPost', 'missing')).toBeUndefined()
  })

  it('projects a collection to entry metadata', async () => {
    expect(await createSource(root).index('author')).toEqual([
      { id: 'author-1', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
    ])
  })

  it('leaves unpublished entries out', async () => {
    const source = createSource(root)

    expect((await source.list('author')).map(row => row.id)).toEqual(['author-1'])
    expect(await source.entry('author', 'author-2')).toBeUndefined()
  })

  it('reads unpublished entries when asked to', async () => {
    const source = createSource(root, defaultPaths, { unpublished: true })

    expect((await source.list('author')).map(row => row.id)).toEqual(['author-1', 'author-2'])
    expect((await source.entry('author', 'author-2'))?.name).toBe('Bob')
  })
})

describe('content that is not plain data', () => {
  const scratch = fileURLToPath(new URL('../node_modules/.forgepress-reader-test', import.meta.url))

  function write(path: string, text: string): void {
    mkdirSync(join(scratch, path, '..'), { recursive: true })
    writeFileSync(join(scratch, path), text)
  }

  beforeAll(() => {
    write('.forgepress/schema.ts', 'export default { collections: { post: { fields: { author: { type: \'relation\', collection: \'autor\' } } } } }\n')
    write('.forgepress/content/post/post_1.ts', [
      'import type { ForgePressEntry } from \'forgepress\'',
      '',
      'export default {',
      '  id: \'post_1\',',
      '  author: globalThis.process.exit(1),',
      '} satisfies ForgePressEntry<\'post\'>',
      '',
    ].join('\n'))
  })

  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  it('refuses to run an entry and points at the expression', async () => {
    await expect(createSource(scratch).list('post'))
      .rejects
      .toThrow('[forgepress] .forgepress/content/post/post_1.ts:5:11 `globalThis` is not a literal value')
  })

  it('reports schema problems with their position', async () => {
    await expect(createSource(scratch).schema())
      .rejects
      .toThrow('[forgepress] .forgepress/schema.ts:1:79 Field "post.author" references unknown collection "autor"')
  })
})
