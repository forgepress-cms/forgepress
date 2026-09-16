import { describe, expect, it } from 'vitest'
import { keyed, once } from '../../src/utils/once'

describe('once', () => {
  it('loads nothing until asked, then shares one load between every caller', async () => {
    let loads = 0
    const value = once(async () => {
      loads += 1

      return 'loaded'
    })

    expect(loads).toBe(0)
    expect(await Promise.all([value(), value()])).toEqual(['loaded', 'loaded'])
    expect(await value()).toBe('loaded')
    expect(loads).toBe(1)
  })

  it('loads again after a load failed', async () => {
    let loads = 0
    const value = once(async () => {
      loads += 1

      if (loads === 1)
        throw new Error('offline')

      return 'loaded'
    })

    await expect(value()).rejects.toThrow('offline')
    expect(await value()).toBe('loaded')
    expect(await value()).toBe('loaded')
    expect(loads).toBe(2)
  })
})

describe('keyed', () => {
  it('shares a load per key and forgets only the keys that failed', async () => {
    const loaded: string[] = []
    const files = keyed<string>()
    const load = (path: string) => async () => {
      loaded.push(path)

      if (path === 'broken' && loaded.filter(item => item === path).length === 1)
        throw new Error(`${path} failed`)

      return `text of ${path}`
    }

    expect(await Promise.all([files('a', load('a')), files('a', load('a')), files('b', load('b'))])).toEqual(['text of a', 'text of a', 'text of b'])
    await expect(files('broken', load('broken'))).rejects.toThrow('broken failed')
    expect(await files('broken', load('broken'))).toBe('text of broken')
    expect(await files('a', load('a'))).toBe('text of a')
    expect(loaded).toEqual(['a', 'b', 'broken', 'broken'])
  })
})
