import { describe, expect, it } from 'vitest'
import { moveItem, moveKey } from '../../../editor/utils/order'

describe('moveItem', () => {
  it('moves an item without changing the list it was given', () => {
    const items = ['a', 'b', 'c']

    expect(moveItem(items, 2, -2)).toEqual(['c', 'a', 'b'])
    expect(moveItem(items, 0, 1)).toEqual(['b', 'a', 'c'])
    expect(items).toEqual(['a', 'b', 'c'])
  })

  it('keeps the list when the move leaves it', () => {
    const items = ['a', 'b']

    expect(moveItem(items, 0, -1)).toBe(items)
    expect(moveItem(items, 1, 1)).toBe(items)
    expect(moveItem(items, -1, 1)).toBe(items)
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
    expect(moveKey(record, 'z', 1)).toBe(record)
  })
})
