import type { KeyValueStore, RepositoryCache } from '../store/types'
import { createIdbCache, createIdbStore } from './idb'
import { createMemoryStore } from './memory'

export const TOKEN_KEY = 'token'
export const CHANGES_KEY = 'changes'

export function persist<TValue>(key: string): KeyValueStore<TValue> {
  return typeof indexedDB === 'undefined' ? createMemoryStore<TValue>() : createIdbStore<TValue>(key)
}

export function repositoryCache(): RepositoryCache | undefined {
  return typeof indexedDB === 'undefined' ? undefined : createIdbCache()
}
