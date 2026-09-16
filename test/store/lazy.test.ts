import type { ContentStore } from '../../src/store/types'
import { describe, expect, it } from 'vitest'
import { lazyStore } from '../../src/store/lazy'

interface Spy extends ContentStore {
  calls: string[]
}

function spy(): Spy {
  const calls: string[] = []

  return {
    calls,
    schema: async () => {
      calls.push('schema')

      return { collections: {}, locales: [] }
    },
    list: async (collection) => {
      calls.push(`list:${collection}`)

      return []
    },
    entry: async (collection, id) => {
      calls.push(`entry:${collection}/${id}`)

      return undefined
    },
    writeEntry: async (collection, row) => {
      calls.push(`writeEntry:${collection}/${row.id}`)
    },
    removeEntry: async (collection, id) => {
      calls.push(`removeEntry:${collection}/${id}`)
    },
  }
}

describe('lazy store', () => {
  it('does not select a store until something is read or written', () => {
    let selected = 0

    lazyStore(async () => {
      selected += 1

      return spy()
    })

    expect(selected).toBe(0)
  })

  it('selects the store again after selecting it failed', async () => {
    let selected = 0

    const store = lazyStore(async () => {
      selected += 1

      if (selected === 1)
        throw new Error('offline')

      return spy()
    })

    await expect(store.list('hero')).rejects.toThrow('offline')
    expect(await store.list('hero')).toEqual([])
  })

  it('delegates every method to the selected store', async () => {
    const target = spy()
    const store = lazyStore(async () => target)

    await store.schema()
    await store.list('hero')
    await store.entry('hero', 'a')
    await store.writeEntry('hero', { id: 'a', status: 'unpublished', createdAt: '', updatedAt: '' })
    await store.removeEntry('hero', 'a')

    expect(target.calls).toEqual([
      'schema',
      'list:hero',
      'entry:hero/a',
      'writeEntry:hero/a',
      'removeEntry:hero/a',
    ])
  })
})
