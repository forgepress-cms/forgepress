import { describe, expect, it } from 'vitest'
import { fillPreview, previewPlaceholders, renamePreviewField } from './preview'

describe('previewPlaceholders', () => {
  it('lists each name in braces once, in order', () => {
    expect(previewPlaceholders('/{locale}/{slug}?from={slug}')).toEqual(['locale', 'slug'])
    expect(previewPlaceholders('/')).toEqual([])
  })
})

describe('fillPreview', () => {
  it('puts the values into the address and keeps the slashes of a path', () => {
    expect(fillPreview('{slug}?locale={locale}', { slug: '/über uns/a&b', locale: 'de' })).toEqual({ path: '/%C3%BCber%20uns/a%26b?locale=de' })
    expect(fillPreview('/posts/{number}', { number: 3 })).toEqual({ path: '/posts/3' })
    expect(fillPreview('/', {})).toEqual({ path: '/' })
  })

  it('names what has no single plain value for the address', () => {
    expect(fillPreview('/{category}/{slug}', { category: '', slug: '/a' })).toEqual({ missing: ['category'] })
    expect(fillPreview('/{tags}/{draft}/{rank}/{author}', { tags: ['a'], draft: true, rank: Number.NaN })).toEqual({ missing: ['tags', 'draft', 'rank', 'author'] })
  })
})

describe('renamePreviewField', () => {
  it('renames every use of the field and leaves other names alone', () => {
    expect(renamePreviewField('/{slug}?s={slug}&t={slugs}', 'slug', 'path')).toBe('/{path}?s={path}&t={slugs}')
  })
})
