import type { Schema } from '../schema'
import type { ContentEntries, EntryIssue } from './references'
import { quote } from '../utils'
import { entryKey } from './references'

function misplaced(collection: string, id: string, single: boolean, named: boolean): string | undefined {
  if (!single)
    return id === collection ? `Collection ${quote(collection)} isn't single, so its entries can't have the id ${quote(id)}; give this entry another id or turn on "single"` : undefined

  if (id === collection)
    return undefined

  return named
    ? `Collection ${quote(collection)} is single and already has ${entryKey(collection, collection)}; remove this entry or turn off "single"`
    : `Collection ${quote(collection)} is single, so its entry needs the id ${quote(collection)}; give it that id or turn off "single"`
}

export function validateSingles(schema: Schema, content: ContentEntries): EntryIssue[] {
  return Object.entries(content).flatMap(([collection, entries]) => {
    const definition = schema.collections[collection]

    if (!definition)
      return []

    return Object.keys(entries).flatMap((id) => {
      const message = misplaced(collection, id, definition.single === true, Object.hasOwn(entries, collection))

      return message === undefined ? [] : [{ collection, id, path: ['id'], message }]
    })
  })
}
