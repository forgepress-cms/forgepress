import type { ContentRow } from '../types/entry'
import { same } from '../utils/value'

export type Overlay = Record<string, ContentRow | null>

export function mergeEntries(rows: readonly ContentRow[], overlay?: Overlay): ContentRow[] {
  if (!overlay)
    return [...rows]

  const merged = new Map(rows.map(row => [row.id, row]))

  for (const [id, row] of Object.entries(overlay)) {
    if (row === null)
      merged.delete(id)
    else
      merged.set(id, row)
  }

  return [...merged.values()]
}

export function stage(overlay: Overlay, before: ContentRow | undefined, row: ContentRow): void {
  if (same(before, row))
    delete overlay[row.id]
  else
    overlay[row.id] = row
}

export function reconcile(overlay: Overlay, existing: readonly ContentRow[], rows: readonly ContentRow[]): void {
  const before = new Map(existing.map(row => [row.id, row]))
  const kept = new Set(rows.map(row => row.id))

  for (const row of existing) {
    if (!kept.has(row.id))
      overlay[row.id] = null
  }

  for (const row of rows)
    stage(overlay, before.get(row.id), row)
}

export function discardAll(overlay: Overlay, existing: readonly ContentRow[]): void {
  for (const row of existing)
    overlay[row.id] = null
}
