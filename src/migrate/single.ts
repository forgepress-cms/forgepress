import type { Entry } from '../entries'
import type { Schema } from '../schema'
import { sortByCreation } from '../entries'

export function singleIds(rows: readonly Entry[], source: string, target: string, schemas: { before: Schema, after: Schema }, createId: (collection: string) => string): ReadonlyMap<string, string> {
  const named = rows.find(row => row.id === source)

  if (schemas.after.collections[target]?.single === true) {
    const kept = named ?? sortByCreation(rows)[0]

    return kept && kept.id !== target ? new Map([[kept.id, target]]) : new Map()
  }

  return schemas.before.collections[source]?.single === true && named ? new Map([[named.id, createId(target)]]) : new Map()
}
