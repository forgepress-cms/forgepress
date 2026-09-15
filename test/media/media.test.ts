import type { MediaConfig } from '../../src/types/config'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assetUrl, checkUpload, isAssetName, isMediaFile, isServed, MEDIA_DEFAULTS, mediaAccept, mediaKind, mediaType, resolveMedia, slugify, sortAssets, storedAsset, toAssetName } from '../../src/media'

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

  it('keeps the defaults when an untyped config sets a key to undefined', () => {
    const loose: Record<string, unknown> = { dir: undefined, url: undefined, maxSize: undefined }

    expect(resolveMedia(loose as MediaConfig)).toEqual(MEDIA_DEFAULTS)
  })

  it('overrides only what is provided', () => {
    expect(resolveMedia({ dir: 'static/media' })).toEqual({ ...MEDIA_DEFAULTS, dir: 'static/media' })
  })
})

describe('checkUpload', () => {
  it('names the media type of a file that fits', () => {
    expect(checkUpload('hero.png', 10, 1024)).toBe('image/png')
  })

  it('rejects an unsupported type and an oversized file', () => {
    expect(() => checkUpload('notes.txt', 10, 1024)).toThrow('"notes.txt" is not a supported media file')
    expect(() => checkUpload('big.png', 2 * 1024 * 1024, 1024 * 1024)).toThrow('"big.png" is larger than the 1 MB upload limit')
  })
})

describe('sortAssets', () => {
  it('puts the newest first and breaks ties by name', () => {
    const asset = (name: string, modifiedAt: string) => ({ name, url: `/uploads/${name}`, type: 'image/png', size: 1, modifiedAt })

    expect(sortAssets([asset('b.png', '2024-01-01'), asset('c.png', '2024-02-01'), asset('a.png', '2024-01-01')]).map(item => item.name))
      .toEqual(['c.png', 'a.png', 'b.png'])
  })

  it('lists files without a date after the dated ones, by name', () => {
    expect(sortAssets([storedAsset('b.png', '/uploads'), { ...storedAsset('z.png', '/uploads'), modifiedAt: '2024-01-01' }, storedAsset('a.png', '/uploads')]).map(item => item.name))
      .toEqual(['z.png', 'a.png', 'b.png'])
  })
})

describe('files in the repository', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('counts only media files with a valid name', () => {
    expect(isMediaFile('team.1a2b3c4d.png')).toBe(true)
    expect(isMediaFile('notes.md')).toBe(false)
    expect(isMediaFile('nested/team.png')).toBe(false)
    expect(isMediaFile('.hidden.png')).toBe(false)
  })

  it('describes a stored file by its name', () => {
    expect(storedAsset('clip.1a2b3c4d.webm', 'https://cdn.example.com/media/')).toEqual({ name: 'clip.1a2b3c4d.webm', url: 'https://cdn.example.com/media/clip.1a2b3c4d.webm', type: 'video/webm' })
  })

  it('knows the site serves a file once it answers with something other than a page', async () => {
    const responses: Record<string, Response> = {
      '/uploads/live.png': new Response(null, { headers: { 'content-type': 'image/png' } }),
      '/uploads/fallback.png': new Response(null, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      '/uploads/missing.png': new Response(null, { status: 404 }),
    }

    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      if (url === '/uploads/offline.png')
        throw new TypeError('Failed to fetch')

      expect(init).toEqual({ method: 'HEAD', cache: 'no-store' })

      return responses[url]
    })

    expect(await isServed('/uploads/live.png')).toBe(true)
    expect(await isServed('/uploads/fallback.png')).toBe(false)
    expect(await isServed('/uploads/missing.png')).toBe(false)
    expect(await isServed('/uploads/offline.png')).toBe(false)
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
