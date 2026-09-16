import type { EntryMeta } from '../../src/entries/types'
import { describe, expect, it } from 'vitest'
import { sortByCreation } from '../../src/entries/order'

function entry(id: string, createdAt: string): EntryMeta {
  return { id, status: 'published', createdAt, updatedAt: createdAt }
}

describe('sortByCreation', () => {
  it('orders entries by creation date, then id', () => {
    const entries = [entry('z', '2024-03-01'), entry('b', '2024-01-01'), entry('a', '2024-01-01')]

    expect(sortByCreation(entries).map(item => item.id)).toEqual(['a', 'b', 'z'])
  })

  it('does not mutate its input', () => {
    const entries = [entry('b', '2024-02-01'), entry('a', '2024-01-01')]

    sortByCreation(entries)

    expect(entries.map(item => item.id)).toEqual(['b', 'a'])
  })
})
