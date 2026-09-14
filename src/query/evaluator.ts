import type { OutputEntry } from '../output/types'
import type { QueryPlan, WhereClause } from './types'
import { isRecord } from '../utils/value'

function comparable(value: unknown): unknown {
  return isRecord(value) && typeof value.collection === 'string' && typeof value.id === 'string' ? value.id : value
}

function compare(left: unknown, right: unknown): number {
  const first = comparable(left)
  const second = comparable(right)

  if (first === second)
    return 0

  if (first === undefined || first === null)
    return -1

  if (second === undefined || second === null)
    return 1

  return (first as string) < (second as string) ? -1 : 1
}

function ranged(actual: unknown, value: unknown, accept: (order: number) => boolean): boolean {
  return actual !== undefined && actual !== null && accept(compare(actual, value))
}

function matches(entry: OutputEntry, { field, op, value }: WhereClause): boolean {
  const actual = entry[field]

  switch (op) {
    case 'eq': return comparable(actual) === value
    case 'ne': return comparable(actual) !== value
    case 'gt': return ranged(actual, value, order => order > 0)
    case 'gte': return ranged(actual, value, order => order >= 0)
    case 'lt': return ranged(actual, value, order => order < 0)
    case 'lte': return ranged(actual, value, order => order <= 0)
    case 'in': return Array.isArray(value) && value.includes(comparable(actual))
    case 'contains':
      return Array.isArray(actual)
        ? actual.some(item => comparable(item) === value)
        : typeof actual === 'string' && typeof value === 'string' && actual.includes(value)
  }
}

export function evaluate(entries: readonly OutputEntry[], plan: QueryPlan): OutputEntry[] {
  let result = plan.where.length > 0 ? entries.filter(entry => plan.where.every(clause => matches(entry, clause))) : [...entries]

  if (plan.sort.length > 0) {
    result.sort((left, right) => {
      for (const { field, dir } of plan.sort) {
        const order = compare(left[field], right[field])

        if (order !== 0)
          return dir === 'asc' ? order : -order
      }

      return 0
    })
  }

  if (plan.offset > 0)
    result = result.slice(plan.offset)

  if (plan.limit !== undefined)
    result = result.slice(0, plan.limit)

  return result
}
