import type { Entry } from '../entries/types'
import { same } from '../utils/value'

export type Overlay = Record<string, Entry | null>

export function mergeEntries(rows: readonly Entry[], overlay?: Overlay): Entry[] {
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

export function stage(overlay: Overlay, before: Entry | undefined, row: Entry): void {
  if (same(before, row))
    delete overlay[row.id]
  else
    overlay[row.id] = row
}
