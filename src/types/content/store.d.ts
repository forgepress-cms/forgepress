import type { ContentSource } from './reader'
import type { ContentWriter } from './writer'

export interface ContentStore extends ContentSource, ContentWriter {}

export interface KeyValueStore<TValue> {
  read: () => Promise<TValue | undefined>
  write: (value: TValue) => Promise<void>
  clear: () => Promise<void>
}
