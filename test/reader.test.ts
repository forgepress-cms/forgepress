import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSource } from '../src/content/reader/node'
import { createReader } from '../src/content/source'

const root = fileURLToPath(new URL('./fixtures/project', import.meta.url))

describe('node reader', () => {
  it('loads the schema from disk', async () => {
    const schema = await createSource(root).schema()

    expect(schema.locales).toEqual(['en', 'de'])
    expect(Object.keys(schema.components)).toEqual(['author', 'blogPost'])
    expect(schema.components.blogPost?.elements.author).toEqual({ type: 'relation', label: 'Author', component: 'author' })
  })

  it('resolves a component to its content file', async () => {
    const rows = await createSource(root).list('blogPost')

    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toEqual({ en: 'Hello', de: 'Hallo' })
  })

  it('treats a component without a content file as empty', async () => {
    expect(await createSource(root).list('missing')).toEqual([])
  })

  it('walks up to the nearest .webenv directory', async () => {
    expect(await createSource(join(root, '.webenv', 'content')).list('author')).toHaveLength(1)
  })

  it('reads each component once', async () => {
    const source = createSource(root)

    expect(await source.list('author')).toBe(await source.list('author'))
  })

  it('backs a content reader', async () => {
    const reader = createReader(createSource(root))

    expect((await reader.get('blogPost', 'blog-post-1'))?.author).toBe('author-1')
    expect(await reader.get('blogPost', 'missing')).toBeUndefined()
  })
})
