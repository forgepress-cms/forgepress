import type { ContentRow } from '../src/types/content/reader'
import type { QueryPlan } from '../src/types/query'
import { describe, expect, it } from 'vitest'
import { evaluate, localize } from '../src/query/evaluator'

function plan(overrides: Partial<QueryPlan> = {}): QueryPlan {
  return { where: [], sort: [], offset: 0, ...overrides }
}

function rows(): ContentRow[] {
  return [
    { id: 'a', status: 'published', createdAt: '2024-01-01', updatedAt: '2024-01-01', views: 10, slug: 'apple-pie', title: { en: 'Apple', de: 'Apfel' }, tags: ['x', 'y'] },
    { id: 'b', status: 'unpublished', createdAt: '2024-03-01', updatedAt: '2024-03-01', views: 30, slug: 'banana-bread', title: { en: 'Banana', de: 'Banane' }, tags: ['y', 'z'] },
    { id: 'c', status: 'published', createdAt: '2024-02-01', updatedAt: '2024-02-01', views: 20, slug: 'cherry-cake', title: { en: 'Cherry', de: 'Kirsche' }, tags: ['z'] },
  ]
}

const ids = (result: ContentRow[]) => result.map(row => row.id)

describe('localize', () => {
  it('flattens translated fields to the chosen locale and leaves others untouched', () => {
    const out = localize(rows()[0]!, new Set(['title']), 'de')
    expect(out.title).toBe('Apfel')
    expect(out.slug).toBe('apple-pie')
  })

  it('does not mutate the input row', () => {
    const row = rows()[0]!
    localize(row, new Set(['title']), 'en')
    expect(row.title).toEqual({ en: 'Apple', de: 'Apfel' })
  })

  it('leaves a missing translated field as undefined without throwing', () => {
    const out = localize({ id: 'x', status: 'published', createdAt: '', updatedAt: '' }, new Set(['title']), 'en')
    expect(out.title).toBeUndefined()
  })
})

describe('evaluate: where', () => {
  it('eq / ne', () => {
    expect(ids(evaluate(rows(), plan({ where: [{ field: 'status', op: 'eq', value: 'published' }] }), new Set()))).toEqual(['a', 'c'])
    expect(ids(evaluate(rows(), plan({ where: [{ field: 'status', op: 'ne', value: 'published' }] }), new Set()))).toEqual(['b'])
  })

  it('gt / gte / lt / lte', () => {
    expect(ids(evaluate(rows(), plan({ where: [{ field: 'views', op: 'gt', value: 20 }] }), new Set()))).toEqual(['b'])
    expect(ids(evaluate(rows(), plan({ where: [{ field: 'views', op: 'gte', value: 20 }] }), new Set()))).toEqual(['b', 'c'])
    expect(ids(evaluate(rows(), plan({ where: [{ field: 'views', op: 'lt', value: 20 }] }), new Set()))).toEqual(['a'])
    expect(ids(evaluate(rows(), plan({ where: [{ field: 'views', op: 'lte', value: 20 }] }), new Set()))).toEqual(['a', 'c'])
  })

  it('in', () => {
    expect(ids(evaluate(rows(), plan({ where: [{ field: 'status', op: 'in', value: ['unpublished'] }] }), new Set()))).toEqual(['b'])
  })

  it('contains on arrays and strings', () => {
    expect(ids(evaluate(rows(), plan({ where: [{ field: 'tags', op: 'contains', value: 'z' }] }), new Set()))).toEqual(['b', 'c'])
    expect(ids(evaluate(rows(), plan({ where: [{ field: 'slug', op: 'contains', value: 'cake' }] }), new Set()))).toEqual(['c'])
  })

  it('combines multiple clauses with AND', () => {
    const result = evaluate(rows(), plan({
      where: [
        { field: 'status', op: 'eq', value: 'published' },
        { field: 'views', op: 'gte', value: 20 },
      ],
    }), new Set())
    expect(ids(result)).toEqual(['c'])
  })
})

describe('evaluate: sort', () => {
  it('sorts ascending and descending', () => {
    expect(ids(evaluate(rows(), plan({ sort: [{ field: 'views', dir: 'asc' }] }), new Set()))).toEqual(['a', 'c', 'b'])
    expect(ids(evaluate(rows(), plan({ sort: [{ field: 'views', dir: 'desc' }] }), new Set()))).toEqual(['b', 'c', 'a'])
  })

  it('applies secondary sort keys as tiebreakers', () => {
    const result = evaluate(rows(), plan({
      sort: [
        { field: 'status', dir: 'asc' },
        { field: 'views', dir: 'desc' },
      ],
    }), new Set())
    expect(ids(result)).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate the input array', () => {
    const input = rows()
    evaluate(input, plan({ sort: [{ field: 'views', dir: 'desc' }] }), new Set())
    expect(ids(input)).toEqual(['a', 'b', 'c'])
  })
})

describe('evaluate: offset and limit', () => {
  it('offset', () => {
    expect(ids(evaluate(rows(), plan({ offset: 1 }), new Set()))).toEqual(['b', 'c'])
  })

  it('limit', () => {
    expect(ids(evaluate(rows(), plan({ limit: 2 }), new Set()))).toEqual(['a', 'b'])
  })

  it('offset and limit together (pagination)', () => {
    expect(ids(evaluate(rows(), plan({ offset: 1, limit: 1 }), new Set()))).toEqual(['b'])
  })
})

describe('evaluate: locale', () => {
  it('flattens translated fields before where/sort run', () => {
    const result = evaluate(rows(), plan({
      locale: 'en',
      where: [{ field: 'title', op: 'eq', value: 'Banana' }],
    }), new Set(['title']))
    expect(ids(result)).toEqual(['b'])
    expect(result[0]!.title).toBe('Banana')
  })

  it('returns raw locale maps when no locale is set', () => {
    expect(evaluate(rows(), plan(), new Set(['title']))[0]!.title).toEqual({ en: 'Apple', de: 'Apfel' })
  })
})
