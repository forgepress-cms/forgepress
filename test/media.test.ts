import { describe, expect, it } from 'vitest'
import { assetUrl, isAssetName, mediaAccept, mediaKind, mediaType, resolveMedia, slugify, toAssetName } from '../src/content/media'

const HASH = 'a3f19c2b7d4e5f60'

describe('resolveMedia', () => {
  it('defaults to public/uploads served at /uploads', () => {
    expect(resolveMedia()).toEqual({ dir: 'public/uploads', url: '/uploads', maxSize: 8 * 1024 * 1024 })
  })

  it('keeps the defaults that are not overridden', () => {
    expect(resolveMedia({ url: 'https://cdn.example.com/media' })).toMatchObject({
      dir: 'public/uploads',
      url: 'https://cdn.example.com/media',
    })
  })
})

describe('slugify', () => {
  it('collapses everything that is not alphanumeric', () => {
    expect(slugify('Hero Banner (final)')).toBe('hero-banner-final')
  })

  it('falls back when nothing readable is left', () => {
    expect(slugify('___')).toBe('file')
  })

  it('caps the length', () => {
    expect(slugify('a'.repeat(80))).toHaveLength(48)
  })
})

describe('toAssetName', () => {
  it('slugifies the stem and appends a short hash', () => {
    expect(toAssetName('Hero Banner.JPG', HASH)).toBe('hero-banner.a3f19c2b.jpg')
  })

  it('handles names without an extension', () => {
    expect(toAssetName('portrait', HASH)).toBe('portrait.a3f19c2b')
  })

  it('is stable for the same file', () => {
    expect(toAssetName('a.png', HASH)).toBe(toAssetName('a.png', HASH))
  })

  it('strips path segments', () => {
    expect(toAssetName('../../etc/passwd.png', HASH)).toBe('etc-passwd.a3f19c2b.png')
  })
})

describe('isAssetName', () => {
  it('accepts generated names', () => {
    expect(isAssetName(toAssetName('hero.png', HASH))).toBe(true)
  })

  it('rejects traversal and separators', () => {
    expect(isAssetName('../hero.png')).toBe(false)
    expect(isAssetName('nested/hero.png')).toBe(false)
    expect(isAssetName('.hidden')).toBe(false)
  })
})

describe('mediaType', () => {
  it('maps known extensions', () => {
    expect(mediaType('hero.a3f19c2b.jpg')).toBe('image/jpeg')
    expect(mediaType('clip.webm')).toBe('video/webm')
  })

  it('rejects everything else', () => {
    expect(mediaType('payload.ts')).toBe('')
    expect(mediaType('README')).toBe('')
  })
})

describe('mediaKind', () => {
  it('splits images from videos', () => {
    expect(mediaKind('hero.png')).toBe('image')
    expect(mediaKind('clip.mp4')).toBe('video')
    expect(mediaKind('notes.txt')).toBeUndefined()
  })
})

describe('mediaAccept', () => {
  it('only offers extensions of the requested kind', () => {
    expect(mediaAccept('video').split(',')).toContain('.mp4')
    expect(mediaAccept('video').split(',')).not.toContain('.png')
    expect(mediaAccept().split(',')).toContain('.png')
  })
})

describe('assetUrl', () => {
  it('joins the prefix with a single slash', () => {
    expect(assetUrl('/uploads', 'hero.png')).toBe('/uploads/hero.png')
    expect(assetUrl('/uploads/', 'hero.png')).toBe('/uploads/hero.png')
    expect(assetUrl('https://cdn.example.com/media/', 'hero.png')).toBe('https://cdn.example.com/media/hero.png')
  })
})
