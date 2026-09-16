import { forceCloseDatabase, IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'

let connections: IDBDatabase[] = []

async function load(): Promise<typeof import('../../src/store/idb')> {
  const factory = new IDBFactory()
  const open = factory.open.bind(factory)

  connections = []
  factory.open = (...args) => {
    const request = open(...args)

    request.addEventListener('success', () => connections.push(request.result))

    return request
  }

  vi.stubGlobal('indexedDB', factory)
  vi.resetModules()

  return await import('../../src/store/idb')
}

function settle<TResult>(request: IDBRequest<TResult>): Promise<TResult> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function seed(name: string, stores: Record<string, Record<string, unknown>>): Promise<void> {
  const opening = indexedDB.open(name, 1)

  opening.onupgradeneeded = () => {
    for (const store of Object.keys(stores))
      opening.result.createObjectStore(store)
  }

  const database = await settle(opening)

  for (const [store, values] of Object.entries(stores)) {
    const objects = database.transaction(store, 'readwrite').objectStore(store)

    await Promise.all(Object.entries(values).map(([key, value]) => settle(objects.put(value, key))))
  }

  database.close()
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('createIdbStore', () => {
  it('keeps each value under its key until that key is cleared', async () => {
    const { createIdbStore } = await load()
    const token = createIdbStore<string>('token')
    const changes = createIdbStore<{ count: number }>('changes')

    await token.write('secret')
    await changes.write({ count: 2 })
    await token.clear()

    expect(await token.read()).toBeUndefined()
    expect(await changes.read()).toEqual({ count: 2 })
  })

  it('reports a write that the database throws away', async () => {
    const { createIdbStore } = await load()
    const store = createIdbStore<string>('token')
    const put = IDBObjectStore.prototype.put

    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const request = put.apply(this, args)

      request.addEventListener('success', () => this.transaction.abort())

      return request
    })

    expect(await store.write('secret').then(() => 'written', () => 'refused')).toBe('refused')
  })

  it('opens the database again after the browser closed it', async () => {
    const { createIdbStore } = await load()
    const store = createIdbStore<string>('token')

    await store.write('secret')

    for (const connection of connections)
      forceCloseDatabase(connection as never)

    expect(await store.read()).toBe('secret')
  })

  it('reads the token and cached files an earlier version stored', async () => {
    const { createIdbCache, createIdbStore } = await load()

    await seed('forgepress', { changes: { token: 'secret' } })
    await seed('forgepress-cache', { files: { abc: 'cached text' }, listings: {} })

    expect(await createIdbStore<string>('token').read()).toBe('secret')
    expect(await createIdbCache().keep(new Set(['abc']))).toEqual(new Map([['abc', 'cached text']]))
  })
})

describe('createIdbCache', () => {
  it('finds a listing only for the commit it was written for', async () => {
    const { createIdbCache } = await load()
    const cache = createIdbCache()
    const files = new Map([['content/post/post_1.ts', 'abc']])

    await cache.writeListing('commit-1', 'content/post', files)

    expect(await cache.readListing('commit-1', 'content/post')).toEqual(files)
    expect(await cache.readListing('commit-2', 'content/post')).toBeUndefined()
  })

  it('keeps the files still in use and drops the rest', async () => {
    const { createIdbCache } = await load()
    const cache = createIdbCache()

    await cache.writeFile('abc', 'first')
    await cache.writeFile('def', 'second')

    expect(await cache.keep(new Set(['abc', 'xyz']))).toEqual(new Map([['abc', 'first']]))
    expect(await cache.keep(new Set(['abc', 'def']))).toEqual(new Map([['abc', 'first']]))
  })

  it('clears files and listings', async () => {
    const { createIdbCache } = await load()
    const cache = createIdbCache()

    await cache.writeFile('abc', 'first')
    await cache.writeListing('commit-1', 'content/post', new Map([['content/post/post_1.ts', 'abc']]))
    await cache.clear()

    expect(await cache.keep(new Set(['abc']))).toEqual(new Map())
    expect(await cache.readListing('commit-1', 'content/post')).toBeUndefined()
  })
})
