import type { KeyValueStore } from '../../store/types'
import { createIdbStore } from './idb'
import { createMemoryStore } from './memory'

export function persist<TValue>(key: string): KeyValueStore<TValue> {
  return typeof indexedDB === 'undefined' ? createMemoryStore<TValue>() : createIdbStore<TValue>(key)
}
