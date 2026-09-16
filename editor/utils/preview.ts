import { isRecord } from '../../src/utils/value'

const LABELS = ['url', 'label', 'title', 'name', 'type', 'id']

function one(value: unknown): string {
  if (value === null || value === undefined || value === '')
    return ''

  if (typeof value !== 'object')
    return String(value)

  const record = value as Record<string, unknown>
  const label = LABELS.find(key => typeof record[key] === 'string' && record[key])

  return label ? String(record[label]) : ''
}

export function localized(value: unknown, locale?: string): unknown {
  return locale && isRecord(value) ? value[locale] : value
}

export function chips(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).map(one).filter(Boolean)
}

export function line(value: unknown): string {
  const items = chips(value)

  if (!items.length)
    return '—'

  return items.length > 2 ? `${items.slice(0, 2).join(', ')} +${items.length - 2}` : items.join(', ')
}
