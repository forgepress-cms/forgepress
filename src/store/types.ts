import type { Entry } from '../entries/types'
import type { ContentIssue } from '../files/issues'
import type { ForgePressSchema } from '../schema/types'

export interface ContentSource {
  schema: () => Promise<ForgePressSchema>
  list: (collection: string) => Promise<Entry[]>
  entry: (collection: string, id: string) => Promise<Entry | undefined>
}

export interface ContentWriter {
  writeEntry: (collection: string, row: Entry) => Promise<void>
  removeEntry: (collection: string, id: string) => Promise<void>
}

export interface EntryWrite {
  collection: string
  entry: Entry
}

export interface SchemaChangeset {
  schema: ForgePressSchema
  write: readonly EntryWrite[]
  collections: readonly string[]
}

export interface MigrationState {
  outstanding?: ForgePressSchema
}

export interface SchemaStore {
  content: () => Promise<Record<string, Entry[]>>
  issues: () => Promise<ContentIssue[]>
  state: () => Promise<MigrationState>
  apply: (changeset: SchemaChangeset) => Promise<void>
  dismiss: () => Promise<void>
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
