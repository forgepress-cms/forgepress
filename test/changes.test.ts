import type { ContentRow, ContentSource } from '../src/types/content/reader'
import type { ContentWriter } from '../src/types/content/writer'
import type { WebenvSchema } from '../src/types/core/schema'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { createChangeSet, createMemoryStore } from '../src/content/changes'

const baseSchema = { components: { hero: { elements: {} } }, locales: ['en'] } as WebenvSchema
const nextSchema = { components: { hero: { elements: {} }, author: { elements: {} } }, locales: ['en'] } as WebenvSchema

function row(id: string): ContentRow {
  return { id, status: 'published', createdAt: '', updatedAt: '' }
}

function base(): ContentSource {
  return {
    schema: async () => baseSchema,
    list: async component => component === 'hero' ? [row('a')] : [],
  }
}

interface Recorder extends ContentWriter {
  calls: string[]
}

function recorder(): Recorder {
  const calls: string[] = []

  return {
    calls,
    writeSchema: async () => {
      calls.push('schema')
    },
    writeContent: async (component, rows) => {
      calls.push(`write:${component}:${rows.map(entry => entry.id).join(',')}`)
    },
    removeContent: async (component) => {
      calls.push(`remove:${component}`)
    },
  }
}

describe('reads', () => {
  it('falls through to the base source while nothing is pending', async () => {
    const changes = createChangeSet(base(), createMemoryStore())

    expect(await changes.list('hero')).toEqual([row('a')])
    expect(await changes.schema()).toEqual(baseSchema)
  })

  it('overlays a pending write over the base source', async () => {
    const changes = createChangeSet(base(), createMemoryStore())

    await changes.writeContent('hero', [row('b')])

    expect(await changes.list('hero')).toEqual([row('b')])
  })

  it('overlays a pending schema', async () => {
    const changes = createChangeSet(base(), createMemoryStore())

    await changes.writeSchema(nextSchema)

    expect(await changes.schema()).toEqual(nextSchema)
  })

  it('reads a removed component as empty', async () => {
    const changes = createChangeSet(base(), createMemoryStore())

    await changes.removeContent('hero')

    expect(await changes.list('hero')).toEqual([])
  })

  it('leaves untouched components reading from the base', async () => {
    const changes = createChangeSet(base(), createMemoryStore())

    await changes.writeContent('author', [row('c')])

    expect(await changes.list('hero')).toEqual([row('a')])
  })
})

describe('persistence', () => {
  it('resumes pending changes from the store', async () => {
    const store = createMemoryStore()

    await createChangeSet(base(), store).writeContent('hero', [row('b')])

    expect(await createChangeSet(base(), store).list('hero')).toEqual([row('b')])
  })

  it('stores cloneable data when handed a reactive array', async () => {
    const store = createMemoryStore()

    await createChangeSet(base(), store).writeContent('hero', reactive([row('b')]))

    const stored = (await store.read())!.components.hero!

    expect(() => structuredClone(stored)).not.toThrow()
    expect(stored).toEqual([row('b')])
  })
})

describe('pending', () => {
  it('separates written from removed components', async () => {
    const changes = createChangeSet(base(), createMemoryStore())

    await changes.writeContent('hero', [row('b')])
    await changes.removeContent('author')

    expect(await changes.pending()).toEqual({ schema: false, written: ['hero'], removed: ['author'] })
  })

  it('flags a pending schema', async () => {
    const changes = createChangeSet(base(), createMemoryStore())

    await changes.writeSchema(nextSchema)

    expect((await changes.pending()).schema).toBe(true)
  })
})

describe('publish', () => {
  it('flushes the schema, writes and removals to the writer', async () => {
    const changes = createChangeSet(base(), createMemoryStore())
    const writer = recorder()

    await changes.writeSchema(nextSchema)
    await changes.writeContent('hero', [row('b')])
    await changes.removeContent('author')

    await changes.publish(writer)

    expect(writer.calls).toEqual(['schema', 'write:hero:b', 'remove:author'])
  })

  it('writes nothing when nothing is pending', async () => {
    const writer = recorder()

    await createChangeSet(base(), createMemoryStore()).publish(writer)

    expect(writer.calls).toEqual([])
  })

  it('clears the change set once published', async () => {
    const store = createMemoryStore()
    const changes = createChangeSet(base(), store)

    await changes.writeContent('hero', [row('b')])
    await changes.publish(recorder())

    expect(await store.read()).toBeUndefined()
    expect(await changes.list('hero')).toEqual([row('a')])
    expect(await changes.pending()).toEqual({ schema: false, written: [], removed: [] })
  })
})

describe('discard', () => {
  it('drops pending changes and falls back to the base', async () => {
    const store = createMemoryStore()
    const changes = createChangeSet(base(), store)

    await changes.writeContent('hero', [row('b')])
    await changes.discard()

    expect(await changes.list('hero')).toEqual([row('a')])
    expect(await store.read()).toBeUndefined()
  })
})
