import type { EntryMeta } from '../core/entry'
import type { ForgePressSchema } from '../core/schema'

export type ContentRow = EntryMeta & {
  [field: string]: unknown
}

export interface ContentSource {
  schema: () => Promise<ForgePressSchema>
  list: (collection: string) => Promise<ContentRow[]>
  index: (collection: string) => Promise<EntryMeta[]>
  entry: (collection: string, id: string) => Promise<ContentRow | undefined>
}
