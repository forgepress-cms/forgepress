import type { Changes } from '../src/types/content/changes'
import type { ContentRow } from '../src/types/content/reader'
import type { ForgePressSchema } from '../src/types/core/schema'
import { describe, expect, it } from 'vitest'
import { commitMessage, toBase64, toFiles } from '../src/content/forge'
import { defaultPaths } from '../src/content/paths'

const schema = { collections: { hero: { fields: {} } }, locales: ['en'] } as ForgePressSchema

function changes(partial: Partial<Changes> = {}): Changes {
  return { entries: {}, dropped: [], uploads: {}, removed: [], ...partial }
}

function row(id: string): ContentRow {
  return { id, status: 'published', createdAt: '', updatedAt: '' }
}

function upload(name: string, text: string) {
  return { name, type: 'image/png', size: text.length, modifiedAt: '', data: new TextEncoder().encode(text).buffer as ArrayBuffer }
}

describe('commit message', () => {
  it('fills the placeholder in the configured template', () => {
    expect(commitMessage('content: {name}', 'new pricing page')).toBe('content: new pricing page')
  })

  it('appends the name when the template has no placeholder', () => {
    expect(commitMessage('content update —', 'new pricing')).toBe('content update — new pricing')
  })

  it('falls back when the editor names nothing', () => {
    expect(commitMessage(undefined, '   ')).toBe('Update content')
    expect(commitMessage('content: {name}', '')).toBe('content: update content')
  })
})

describe('file changes', () => {
  it('writes the schema to its source file', () => {
    const [file] = toFiles(changes({ schema }), { paths: defaultPaths, mediaDir: 'public/uploads' })

    expect(file).toMatchObject({ path: '.forgepress/schema.ts', encoding: 'utf-8' })
    expect(file && 'data' in file && file.data).toContain('satisfies ForgePressSchema')
  })

  it('maps an entry onto a file inside the kebab-case collection directory', () => {
    const [file] = toFiles(changes({ entries: { blogPost: { p1: row('p1') } } }), { paths: defaultPaths, mediaDir: 'public/uploads' })

    expect(file?.path).toBe('.forgepress/content/blog-post/p1.ts')
  })

  it('marks a removed entry for deletion', () => {
    const [file] = toFiles(changes({ entries: { blogPost: { p1: null } } }), { paths: defaultPaths, mediaDir: 'public/uploads' })

    expect(file).toEqual({ path: '.forgepress/content/blog-post/p1.ts', removed: true })
  })

  it('writes only the entries that changed', () => {
    const files = toFiles(changes({ entries: { blogPost: { p2: row('p2') } } }), { paths: defaultPaths, mediaDir: 'public/uploads' })

    expect(files.map(file => file.path)).toEqual(['.forgepress/content/blog-post/p2.ts'])
  })

  it('writes uploads into the media directory as base64', () => {
    const [file] = toFiles(changes({ uploads: { 'a.png': upload('a.png', 'hi') } }), { paths: defaultPaths, mediaDir: 'public/uploads' })

    expect(file).toEqual({ path: 'public/uploads/a.png', data: btoa('hi'), encoding: 'base64' })
  })

  it('marks removed assets for deletion', () => {
    const [file] = toFiles(changes({ removed: ['old.png'] }), { paths: defaultPaths, mediaDir: 'public/uploads' })

    expect(file).toEqual({ path: 'public/uploads/old.png', removed: true })
  })

  it('gathers content, schema and media into one commit', () => {
    const files = toFiles(
      changes({
        schema,
        entries: { hero: { h1: row('h1') }, gone: { g1: null } },
        uploads: { 'a.png': upload('a.png', 'hi') },
        removed: ['old.png'],
      }),
      { paths: defaultPaths, mediaDir: 'public/uploads' },
    )

    expect(files.map(file => file.path)).toEqual([
      '.forgepress/schema.ts',
      '.forgepress/content/hero/h1.ts',
      '.forgepress/content/gone/g1.ts',
      'public/uploads/a.png',
      'public/uploads/old.png',
    ])
  })

  it('prefixes every path when the project sits inside a larger repo', () => {
    const files = toFiles(
      changes({ schema, entries: { hero: { h1: row('h1') } }, uploads: { 'a.png': upload('a.png', 'hi') }, removed: ['old.png'] }),
      { paths: defaultPaths, mediaDir: 'public/uploads', base: 'playgrounds/nuxt' },
    )

    expect(files.map(file => file.path)).toEqual([
      'playgrounds/nuxt/.forgepress/schema.ts',
      'playgrounds/nuxt/.forgepress/content/hero/h1.ts',
      'playgrounds/nuxt/public/uploads/a.png',
      'playgrounds/nuxt/public/uploads/old.png',
    ])
  })

  it('tolerates a base with stray slashes', () => {
    const [file] = toFiles(changes({ schema }), { paths: defaultPaths, mediaDir: 'public/uploads', base: '/apps/site/' })

    expect(file?.path).toBe('apps/site/.forgepress/schema.ts')
  })

  it('produces nothing when there is nothing pending', () => {
    expect(toFiles(changes(), { paths: defaultPaths, mediaDir: 'public/uploads' })).toEqual([])
  })
})

describe('base64', () => {
  it('round-trips binary data', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255])

    expect(toBase64(bytes.buffer)).toBe(btoa(String.fromCharCode(...bytes)))
  })

  it('handles data larger than one chunk', () => {
    const bytes = new Uint8Array(0x8000 * 2 + 5).fill(65)

    expect(atob(toBase64(bytes.buffer))).toHaveLength(bytes.length)
  })
})
