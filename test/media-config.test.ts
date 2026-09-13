import type { MediaConfig } from '../src/types/config'
import { describe, expect, it } from 'vitest'
import { MEDIA_DEFAULTS, resolveMedia } from '../src/media'

describe('resolveMedia', () => {
  it('falls back to the defaults', () => {
    expect(resolveMedia()).toEqual(MEDIA_DEFAULTS)
  })

  it('keeps the defaults when an untyped config sets a key to undefined', () => {
    const loose: Record<string, unknown> = { dir: undefined, url: undefined, maxSize: undefined }

    expect(resolveMedia(loose as MediaConfig)).toEqual(MEDIA_DEFAULTS)
  })

  it('overrides only what is provided', () => {
    expect(resolveMedia({ dir: 'static/media' })).toEqual({ ...MEDIA_DEFAULTS, dir: 'static/media' })
  })
})
