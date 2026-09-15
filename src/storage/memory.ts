import type { KeyValueStore } from '../store/types'

export function createMemoryStore<TValue>(): KeyValueStore<TValue> {
  let value: TValue | undefined

  return {
    read: async () => value,
    write: async (next) => {
      value = next
    },
    clear: async () => {
      value = undefined
    },
  }
}
