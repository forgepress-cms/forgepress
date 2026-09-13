import { describe, expect, it } from 'vitest'
import { createPaths, defaultPaths, normalizeDir, toCollectionDir, toCollectionName } from '../src/files/paths'

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

describe('collection directories', () => {
  it('round trips camel case names', () => {
    for (const name of ['blogPost', 'hero', 'textBlock', 'blog2Post'])
      expect(toCollectionName(toCollectionDir(name))).toBe(name)
  })

  it('does not emit a leading dash for a capitalised name', () => {
    expect(toCollectionDir('BlogPost')).toBe('blog-post')
  })
})
