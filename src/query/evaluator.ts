import type { ContentRow } from '../types/content/reader'
import type { QueryPlan, WhereClause } from '../types/query'

function compare(a: unknown, b: unknown): number {
  if (a === b)
    return 0
  if (a == null)
    return -1
  if (b == null)
    return 1

  return a < b ? -1 : 1
}

function matches(row: ContentRow, { field, op, value }: WhereClause): boolean {
  const actual = row[field]

  switch (op) {
    case 'eq': return actual === value
    case 'ne': return actual !== value
    case 'gt': return compare(actual, value) > 0
    case 'gte': return compare(actual, value) >= 0
    case 'lt': return compare(actual, value) < 0
    case 'lte': return compare(actual, value) <= 0
    case 'in': return Array.isArray(value) && value.includes(actual)
    case 'contains':
      return Array.isArray(actual)
        ? actual.includes(value)
        : typeof actual === 'string' && typeof value === 'string' && actual.includes(value)
  }
}

export function localize(row: ContentRow, translated: Set<string>, locale: string): ContentRow {
  const out: ContentRow = { ...row }

  for (const field of translated) {
    const value = out[field]

    if (value && typeof value === 'object')
      out[field] = (value as Record<string, unknown>)[locale]
  }

  return out
}

export function evaluate(rows: ContentRow[], plan: QueryPlan, translated: Set<string>): ContentRow[] {
  let result = plan.locale
    ? rows.map(row => localize(row, translated, plan.locale!))
    : rows

  if (plan.where.length)
    result = result.filter(row => plan.where.every(clause => matches(row, clause)))

  if (plan.sort.length) {
    result = [...result].sort((a, b) => {
      for (const { field, dir } of plan.sort) {
        const order = compare(a[field], b[field])

        if (order !== 0)
          return dir === 'asc' ? order : -order
      }

      return 0
    })
  }

  if (plan.offset)
    result = result.slice(plan.offset)

  if (plan.limit != null)
    result = result.slice(0, plan.limit)

  return result
}
