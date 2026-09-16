import { describe, expect, it } from 'vitest'
import { createPaths, defaultPaths, normalizeDir, prefixer, repositoryPath, repositoryPaths, toCollectionDir, toCollectionName, toEntryRef } from '../../src/files/paths'

describe('createPaths', () => {
  it('defaults to the .forgepress directory', () => {
    expect(defaultPaths.dir).toBe('.forgepress')
    expect(defaultPaths.content).toBe('.forgepress/content')
    expect(defaultPaths.schema).toBe('.forgepress/schema.ts')
    expect(defaultPaths.types).toBe('.forgepress/forgepress.d.ts')
  })

  it('places content under a configured directory', () => {
    const paths = createPaths('src/cms')

    expect(paths.schema).toBe('src/cms/schema.ts')
    expect(paths.collection('blogPost')).toBe('src/cms/content/blog-post')
    expect(paths.entry('blogPost', 'p1')).toBe('src/cms/content/blog-post/p1.ts')
  })

  it('trims edge slashes and falls back when the path is empty', () => {
    expect(normalizeDir('/content/')).toBe('content')
    expect(normalizeDir('')).toBe('.forgepress')
    expect(normalizeDir(undefined)).toBe('.forgepress')
  })
})

describe('repository paths', () => {
  it('puts paths below the folder of the project in the repository', () => {
    expect(prefixer('playgrounds/nuxt')('.forgepress/schema.ts')).toBe('playgrounds/nuxt/.forgepress/schema.ts')
    expect(prefixer('/docs/')('public/uploads')).toBe('docs/public/uploads')
    expect(prefixer()('.forgepress/content')).toBe('.forgepress/content')
    expect(prefixer('')('.forgepress/content')).toBe('.forgepress/content')
  })

  it('resolves a content folder next to the project, like one shared by several playgrounds', () => {
    const at = prefixer('playgrounds/nuxt')
    const paths = createPaths('../.forgepress')

    expect(at(paths.dir)).toBe('playgrounds/.forgepress')
    expect(at(paths.entry('blogPost', 'post_1'))).toBe('playgrounds/.forgepress/content/blog-post/post_1.ts')
    expect(toEntryRef(at(paths.content), 'playgrounds/.forgepress/content/blog-post/post_1.ts')).toEqual({ collection: 'blogPost', id: 'post_1' })
  })

  it('names every content path from the root of the repository', () => {
    const paths = repositoryPaths(createPaths('../.forgepress'), '/playgrounds/nuxt/')

    expect([paths.dir, paths.content, paths.schema, paths.types]).toEqual([
      'playgrounds/.forgepress',
      'playgrounds/.forgepress/content',
      'playgrounds/.forgepress/schema.ts',
      'playgrounds/.forgepress/forgepress.d.ts',
    ])
    expect(paths.collection('blogPost')).toBe('playgrounds/.forgepress/content/blog-post')
    expect(paths.entry('blogPost', 'post_1')).toBe('playgrounds/.forgepress/content/blog-post/post_1.ts')
    expect(repositoryPaths(defaultPaths).entry('hero', 'h1')).toBe('.forgepress/content/hero/h1.ts')
  })

  it('reads the same path however it is written', () => {
    expect(repositoryPath('./docs//.forgepress/./content/')).toBe('docs/.forgepress/content')
    expect(repositoryPath('apps\\site\\..\\docs\\.forgepress')).toBe('apps/docs/.forgepress')
  })

  it('refuses paths that leave the repository', () => {
    expect(() => prefixer('docs')('../../.forgepress')).toThrow('"docs/../../.forgepress" points outside the repository')
    expect(() => prefixer()('../.forgepress')).toThrow('points outside the repository')
  })
})

describe('collection directories', () => {
  it('round trips camel case names', () => {
    for (const name of ['blogPost', 'hero', 'textBlock', 'blog2Post'])
      expect(toCollectionName(toCollectionDir(name))).toBe(name)
  })

  it('does not emit a leading dash for a capitalised name', () => {
    expect(toCollectionDir('BlogPost')).toBe('blog-post')
  })
})

describe('entry files', () => {
  it('finds the entry a file in a collection folder holds', () => {
    expect(toEntryRef('.forgepress/content', '.forgepress/content/blog-post/post_1.ts')).toEqual({ collection: 'blogPost', id: 'post_1' })
    expect(toEntryRef('apps/site/.forgepress/content', 'apps/site/.forgepress/content/author/author-1.ts')).toEqual({ collection: 'author', id: 'author-1' })
  })

  it('ignores files that are not entries in a collection folder', () => {
    for (const path of [
      '.forgepress/schema.ts',
      '.forgepress/content/post_1.ts',
      '.forgepress/content/author/notes.md',
      '.forgepress/content/author/drafts/author_1.ts',
      '.forgepress/content-archive/author/author_1.ts',
      'src/content/author/author_1.ts',
    ]) {
      expect(toEntryRef('.forgepress/content', path)).toBeUndefined()
    }
  })
})
