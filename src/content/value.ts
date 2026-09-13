export function filled(value: unknown): boolean {
  if (Array.isArray(value))
    return value.length > 0

  return !(value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value)))
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : filled(value) ? [value] : []
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function plain<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue
}

export function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export function defined<TValue extends object>(value: TValue | undefined): Partial<TValue> {
  if (!value)
    return {}

  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<TValue>
}
