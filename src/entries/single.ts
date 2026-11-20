import type { Schema } from '../schema'
import type { ContentEntries, EntryIssue } from './references'
import { quote } from '../utils'
import { sortByCreation } from './order'
import { entryKey } from './references'

export function validateSingles(schema: Schema, content: ContentEntries): EntryIssue[] {
  return Object.entries(schema.collections).filter(([, definition]) => definition.single === true).flatMap(([collection]) => {
    const [kept, ...extra] = sortByCreation(Object.values(content[collection] ?? {}))

    return extra.map(row => ({
      collection,
      id: row.id,
      path: ['id'],
      message: `Collection ${quote(collection)} is single and already has ${entryKey(collection, kept!.id)}; remove this entry or turn off "single"`,
    }))
  })
}
