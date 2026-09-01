import { describe, expect, it } from 'vitest'
import { moveKey, toKey } from '../src/editor/utils/schema'

describe('toKey', () => {
  it('camel cases names', () => {
    expect(toKey('Blog post')).toBe('blogPost')
    expect(toKey('  cover image ')).toBe('coverImage')
    expect(toKey('2 fast')).toBe('fast')
  })
})

describe('moveKey', () => {
  it('moves a key without touching the values', () => {
    const record = { a: 1, b: 2, c: 3 }
    expect(Object.keys(moveKey(record, 'c', -1))).toEqual(['a', 'c', 'b'])
    expect(Object.keys(moveKey(record, 'a', 1))).toEqual(['b', 'a', 'c'])
  })

  it('keeps the record at the edges', () => {
    const record = { a: 1, b: 2 }
    expect(moveKey(record, 'a', -1)).toBe(record)
    expect(moveKey(record, 'b', 1)).toBe(record)
  })
})
