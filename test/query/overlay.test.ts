import { afterEach, describe, expect, it } from 'vitest'
import { overlaid, overlayContent } from '../../src/query/overlay'

afterEach(() => {
  overlayContent(undefined)
})

describe('content overlay', () => {
  it('reads the base until something overlays it, and again once the overlay is gone', async () => {
    const reader = overlaid(async path => `base ${path}`)

    expect(await reader('index.json')).toBe('base index.json')

    overlayContent(async (path, base) => path === 'index.json' ? 'preview index.json' : base(path))

    expect(await reader('index.json')).toBe('preview index.json')
    expect(await reader('author/index.1.json')).toBe('base author/index.1.json')

    overlayContent(undefined)

    expect(await reader('index.json')).toBe('base index.json')
  })
})
