import type { NumberField } from '../schema/fields/number'

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z\d]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function precise(value: number): number {
  return Number(value.toPrecision(12))
}

export function nearest(value: number, field: NumberField): number {
  const { min, max, step } = field
  const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value))

  if (step === undefined || step <= 0)
    return bounded

  const base = min ?? 0
  const snapped = precise(base + Math.round((bounded - base) / step) * step)

  if (max !== undefined && snapped > max)
    return precise(snapped - step)

  return min !== undefined && snapped < min ? precise(snapped + step) : snapped
}
