import type { WebenvSchema } from '../core/schema'
import type { ContentRow, ContentSource } from './reader'
import type { ContentWriter } from './writer'

export interface ContentStore extends ContentSource, ContentWriter {}

export interface StoredChanges {
  published?: string
  schema?: WebenvSchema
  components: Record<string, ContentRow[] | null>
}

export interface KeyValueStore<TValue> {
  read: () => Promise<TValue | undefined>
  write: (value: TValue) => Promise<void>
  clear: () => Promise<void>
}

export type ChangeStore = KeyValueStore<StoredChanges>

export interface PendingChanges {
  published?: string
  schema: boolean
  written: string[]
  removed: string[]
}

export interface ChangeSet extends ContentStore {
  pending: () => Promise<PendingChanges>
  snapshot: () => Promise<StoredChanges>
  published: (commit: string) => Promise<void>
  publish: (writer: ContentWriter) => Promise<void>
  discard: () => Promise<void>
}
