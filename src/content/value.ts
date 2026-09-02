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
