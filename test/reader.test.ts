import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSource } from '../src/content/reader/node'

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
})
