import type { ContentRow } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'

export interface ContentSource {
  schema: () => Promise<ForgePressSchema>
  list: (collection: string) => Promise<ContentRow[]>
  entry: (collection: string, id: string) => Promise<ContentRow | undefined>
}

export interface ContentWriter {
  writeEntry: (collection: string, row: ContentRow) => Promise<void>
  removeEntry: (collection: string, id: string) => Promise<void>
}

export interface SchemaWriter {
  writeSchema: (schema: ForgePressSchema) => Promise<void>
  writeContent: (collection: string, rows: ContentRow[]) => Promise<void>
  removeCollection: (collection: string) => Promise<void>
}

export interface ContentStore extends ContentSource, ContentWriter {}

export interface KeyValueStore<TValue> {
  read: () => Promise<TValue | undefined>
  write: (value: TValue) => Promise<void>
  clear: () => Promise<void>
}

export interface RepositoryCache {
  readListing: (commit: string, directory: string) => Promise<ReadonlyMap<string, string> | undefined>
  writeListing: (commit: string, directory: string, files: ReadonlyMap<string, string>) => Promise<void>
  keep: (hashes: ReadonlySet<string>) => Promise<ReadonlyMap<string, string>>
  writeFile: (hash: string, text: string) => Promise<void>
  clear: () => Promise<void>
}
