import type { StoredMedia } from '../src/types/content/media'
import type { StoredChanges } from '../src/types/content/store'
import type { WebenvSchema } from '../src/types/core/schema'
import { describe, expect, it } from 'vitest'
import { commitMessage, toBase64, toFiles } from '../src/content/forge'

const schema = { components: { hero: { elements: {} } }, locales: ['en'] } as WebenvSchema

function changes(partial: Partial<StoredChanges> = {}): StoredChanges {
  return { components: {}, ...partial }
}

function media(partial: Partial<StoredMedia> = {}): StoredMedia {
  return { uploads: {}, removed: [], ...partial }
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
    const [file] = toFiles(changes({ schema }), media(), { mediaDir: 'public/uploads' })

    expect(file).toMatchObject({ path: '.webenv/schema.ts', encoding: 'utf-8' })
    expect(file && 'data' in file && file.data).toContain('defineWebenvSchema')
  })

  it('maps a component onto its kebab-case content file', () => {
    const [file] = toFiles(changes({ components: { blogPost: [] } }), media(), { mediaDir: 'public/uploads' })

    expect(file?.path).toBe('.webenv/content/blog-post.ts')
  })

  it('marks a removed component for deletion', () => {
    const [file] = toFiles(changes({ components: { blogPost: null } }), media(), { mediaDir: 'public/uploads' })

    expect(file).toEqual({ path: '.webenv/content/blog-post.ts', removed: true })
  })

  it('writes uploads into the media directory as base64', () => {
    const [file] = toFiles(changes(), media({ uploads: { 'a.png': upload('a.png', 'hi') } }), { mediaDir: 'public/uploads' })

    expect(file).toEqual({ path: 'public/uploads/a.png', data: btoa('hi'), encoding: 'base64' })
  })

  it('marks removed assets for deletion', () => {
    const [file] = toFiles(changes(), media({ removed: ['old.png'] }), { mediaDir: 'public/uploads' })

    expect(file).toEqual({ path: 'public/uploads/old.png', removed: true })
  })

  it('gathers content, schema and media into one commit', () => {
    const files = toFiles(
      changes({ schema, components: { hero: [], gone: null } }),
      media({ uploads: { 'a.png': upload('a.png', 'hi') }, removed: ['old.png'] }),
      { mediaDir: 'public/uploads' },
    )

    expect(files.map(file => file.path)).toEqual([
      '.webenv/schema.ts',
      '.webenv/content/hero.ts',
      '.webenv/content/gone.ts',
      'public/uploads/a.png',
      'public/uploads/old.png',
    ])
  })

  it('prefixes every path when the project sits inside a larger repo', () => {
    const files = toFiles(
      changes({ schema, components: { hero: [] } }),
      media({ uploads: { 'a.png': upload('a.png', 'hi') }, removed: ['old.png'] }),
      { mediaDir: 'public/uploads', base: 'playgrounds/nuxt' },
    )

    expect(files.map(file => file.path)).toEqual([
      'playgrounds/nuxt/.webenv/schema.ts',
      'playgrounds/nuxt/.webenv/content/hero.ts',
      'playgrounds/nuxt/public/uploads/a.png',
      'playgrounds/nuxt/public/uploads/old.png',
    ])
  })

  it('tolerates a base with stray slashes', () => {
    const [file] = toFiles(changes({ schema }), media(), { mediaDir: 'public/uploads', base: '/apps/site/' })

    expect(file?.path).toBe('apps/site/.webenv/schema.ts')
  })

  it('produces nothing when there is nothing pending', () => {
    expect(toFiles(changes(), media(), { mediaDir: 'public/uploads' })).toEqual([])
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
