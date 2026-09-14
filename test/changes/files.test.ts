import type { Changes } from '../../src/changes/types'
import type { Entry } from '../../src/types/entry'
import { describe, expect, it } from 'vitest'
import { toFiles } from '../../src/changes/files'
import { defaultPaths } from '../../src/files/paths'

const target = { paths: defaultPaths, mediaDir: 'public/uploads' }

function changes(partial: Partial<Changes> = {}): Changes {
  return { entries: {}, uploads: {}, removed: [], ...partial }
}

function row(id: string): Entry {
  return { id, status: 'published', createdAt: '', updatedAt: '' }
}

function upload(name: string, text: string) {
  return { name, type: 'image/png', size: text.length, modifiedAt: '', data: new TextEncoder().encode(text).buffer as ArrayBuffer }
}

describe('file changes', () => {
  it('maps an entry onto a file inside the kebab-case collection directory', () => {
    const [file] = toFiles(changes({ entries: { blogPost: { p1: row('p1') } } }), target)

    expect(file).toMatchObject({ path: '.forgepress/content/blog-post/p1.ts', encoding: 'utf-8' })
    expect(file && 'data' in file && file.data).toContain('satisfies ForgePressEntry<\'blogPost\'>')
  })

  it('marks a removed entry for deletion', () => {
    const [file] = toFiles(changes({ entries: { blogPost: { p1: null } } }), target)

    expect(file).toEqual({ path: '.forgepress/content/blog-post/p1.ts', removed: true })
  })

  it('names the hash each entry file replaces', () => {
    const files = toFiles(changes({
      entries: { hero: { h1: row('h1'), h2: null, h3: row('h3') } },
      hashes: { entries: { hero: { h1: 'b-h1', h2: 'b-h2', h3: null } } },
    }), target)

    expect(files.map(file => [file.path, file.replaces])).toEqual([
      ['.forgepress/content/hero/h1.ts', 'b-h1'],
      ['.forgepress/content/hero/h2.ts', 'b-h2'],
      ['.forgepress/content/hero/h3.ts', null],
    ])
  })

  it('writes only the entries that changed', () => {
    const files = toFiles(changes({ entries: { blogPost: { p2: row('p2') } } }), target)

    expect(files.map(file => file.path)).toEqual(['.forgepress/content/blog-post/p2.ts'])
  })

  it('writes uploads into the media directory as base64', () => {
    const [file] = toFiles(changes({ uploads: { 'a.png': upload('a.png', 'hi') } }), target)

    expect(file).toEqual({ path: 'public/uploads/a.png', data: btoa('hi'), encoding: 'base64' })
  })

  it('marks removed assets for deletion', () => {
    const [file] = toFiles(changes({ removed: ['old.png'] }), target)

    expect(file).toEqual({ path: 'public/uploads/old.png', removed: true })
  })

  it('gathers content and media into one commit', () => {
    const files = toFiles(
      changes({
        entries: { hero: { h1: row('h1') }, gone: { g1: null } },
        uploads: { 'a.png': upload('a.png', 'hi') },
        removed: ['old.png'],
      }),
      target,
    )

    expect(files.map(file => file.path)).toEqual([
      '.forgepress/content/hero/h1.ts',
      '.forgepress/content/gone/g1.ts',
      'public/uploads/a.png',
      'public/uploads/old.png',
    ])
  })

  it('prefixes every path when the project sits inside a larger repo', () => {
    const files = toFiles(
      changes({ entries: { hero: { h1: row('h1') } }, uploads: { 'a.png': upload('a.png', 'hi') }, removed: ['old.png'] }),
      { ...target, base: 'playgrounds/nuxt' },
    )

    expect(files.map(file => file.path)).toEqual([
      'playgrounds/nuxt/.forgepress/content/hero/h1.ts',
      'playgrounds/nuxt/public/uploads/a.png',
      'playgrounds/nuxt/public/uploads/old.png',
    ])
  })

  it('tolerates a base with stray slashes', () => {
    const [file] = toFiles(changes({ entries: { hero: { h1: row('h1') } } }), { ...target, base: '/apps/site/' })

    expect(file?.path).toBe('apps/site/.forgepress/content/hero/h1.ts')
  })

  it('produces nothing when there is nothing pending', () => {
    expect(toFiles(changes(), target)).toEqual([])
  })
})
