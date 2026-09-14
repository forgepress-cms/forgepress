import type { OutputEntry } from '../../src/output/types'
import type { QueryPlan } from '../../src/query/types'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../../src/query/evaluator'

function plan(overrides: Partial<QueryPlan> = {}): QueryPlan {
  return { where: [], sort: [], offset: 0, with: [], ...overrides }
}

const entries: OutputEntry[] = [
  { id: 'a', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-05T00:00:00Z', views: 10, title: 'Apple pie', author: { collection: 'author', id: 'alice' }, tags: [{ collection: 'tag', id: 'sweet' }] },
  { id: 'b', createdAt: '2024-03-01T00:00:00Z', updatedAt: '2024-03-01T00:00:00Z', views: 30, title: 'Banana bread', author: { collection: 'author', id: 'bob' }, tags: [{ collection: 'tag', id: 'sweet' }, { collection: 'tag', id: 'baked' }] },
  { id: 'c', createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z', title: 'Cherry cake', author: { collection: 'author', id: 'alice' } },
]

function ids(overrides: Partial<QueryPlan>): string[] {
  return evaluate(entries, plan(overrides)).map(entry => entry.id)
}

describe('evaluate', () => {
  it('keeps the given order without clauses', () => {
    expect(ids({})).toEqual(['a', 'b', 'c'])
  })

  it('compares values, and links by the id of the linked entry', () => {
    expect(ids({ where: [{ field: 'title', op: 'eq', value: 'Banana bread' }] })).toEqual(['b'])
    expect(ids({ where: [{ field: 'author', op: 'eq', value: 'alice' }] })).toEqual(['a', 'c'])
    expect(ids({ where: [{ field: 'author', op: 'ne', value: 'alice' }] })).toEqual(['b'])
    expect(ids({ where: [{ field: 'author', op: 'in', value: ['bob', 'carol'] }] })).toEqual(['b'])
  })

  it('matches ranges only where the field has a value', () => {
    expect(ids({ where: [{ field: 'views', op: 'gt', value: 10 }] })).toEqual(['b'])
    expect(ids({ where: [{ field: 'views', op: 'gte', value: 10 }] })).toEqual(['a', 'b'])
    expect(ids({ where: [{ field: 'views', op: 'lt', value: 30 }] })).toEqual(['a'])
    expect(ids({ where: [{ field: 'views', op: 'lte', value: 30 }] })).toEqual(['a', 'b'])
    expect(ids({ where: [{ field: 'createdAt', op: 'gt', value: '2024-01-15' }] })).toEqual(['b', 'c'])
  })

  it('finds text in strings and links in lists', () => {
    expect(ids({ where: [{ field: 'title', op: 'contains', value: 'ca' }] })).toEqual(['c'])
    expect(ids({ where: [{ field: 'tags', op: 'contains', value: 'sweet' }] })).toEqual(['a', 'b'])
    expect(ids({ where: [{ field: 'tags', op: 'contains', value: 'baked' }] })).toEqual(['b'])
  })

  it('combines every clause', () => {
    expect(ids({ where: [{ field: 'author', op: 'eq', value: 'alice' }, { field: 'title', op: 'contains', value: 'pie' }] })).toEqual(['a'])
  })

  it('sorts by several fields, missing values first, links by id', () => {
    expect(ids({ sort: [{ field: 'views', dir: 'asc' }] })).toEqual(['c', 'a', 'b'])
    expect(ids({ sort: [{ field: 'views', dir: 'desc' }] })).toEqual(['b', 'a', 'c'])
    expect(ids({ sort: [{ field: 'author', dir: 'desc' }, { field: 'createdAt', dir: 'desc' }] })).toEqual(['b', 'c', 'a'])
  })

  it('pages with offset and limit after sorting, without touching the input', () => {
    expect(ids({ sort: [{ field: 'createdAt', dir: 'asc' }], offset: 1, limit: 1 })).toEqual(['c'])
    expect(entries.map(entry => entry.id)).toEqual(['a', 'b', 'c'])
  })
})
