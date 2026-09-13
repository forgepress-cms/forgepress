import type { UnpluginContextMeta } from 'unplugin'
import type { ContentStore } from '../src/types/content/store'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { lazyStore } from '../src/content/store'
import { unpluginFactory } from '../src/unplugin'

const root = fileURLToPath(new URL('./fixtures/project', import.meta.url))

function loader(command: 'serve' | 'build', write?: false) {
  const created = unpluginFactory(write === false ? { root, write } : { root }, { framework: 'vite' } as UnpluginContextMeta)
  const plugin = Array.isArray(created) ? created[0]! : created

  const configResolved = (plugin.vite as { configResolved: (config: { command: string, root: string }) => void }).configResolved
  const load = plugin.load as unknown as (id: string) => Promise<string> | string
  const resolveId = plugin.resolveId as unknown as (id: string) => string | undefined

  configResolved({ command, root })

  return { load: async (id: string) => await load(id) ?? '', resolveId }
}

async function generated(command: 'serve' | 'build', write?: false): Promise<string> {
  return loader(command, write).load('\0virtual:forgepress/content')
}

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
    index: async (collection) => {
      calls.push(`index:${collection}`)

      return []
    },
    entry: async (collection, id) => {
      calls.push(`entry:${collection}/${id}`)

      return undefined
    },
    writeSchema: async () => {
      calls.push('writeSchema')
    },
    writeEntry: async (collection, row) => {
      calls.push(`writeEntry:${collection}/${row.id}`)
    },
    removeEntry: async (collection, id) => {
      calls.push(`removeEntry:${collection}/${id}`)
    },
    writeContent: async (collection) => {
      calls.push(`writeContent:${collection}`)
    },
    removeCollection: async (collection) => {
      calls.push(`removeCollection:${collection}`)
    },
  }
}

describe('local endpoint detection', () => {
  it('reports a dev server as local', async () => {
    expect(await generated('serve')).toContain('export const local = true')
  })

  it('reports a production build as not local', async () => {
    expect(await generated('build')).toContain('export const local = false')
  })

  it('reports a dev server with the write endpoint disabled as not local', async () => {
    expect(await generated('serve', false)).toContain('export const local = false')
  })

  it('still emits the schema and content bindings', async () => {
    const code = await generated('serve')

    expect(code).toContain('export const schema = {"locales":["en","de"]')
    expect(code).toContain('"blogPost"')
  })
})

describe('generated content graph', () => {
  it('gives every collection a list and one loader per entry', async () => {
    const code = await generated('serve')

    expect(code).toContain('list: () => import("virtual:forgepress/list/blog-post")')
    expect(code).toContain('"blog-post-1": () => import("virtual:forgepress/entry/blog-post/blog-post-1")')
  })

  it('resolves the per-collection and per-entry module ids', () => {
    const { resolveId } = loader('serve')

    expect(resolveId('virtual:forgepress/list/author')).toBe('\0virtual:forgepress/list/author')
    expect(resolveId('virtual:forgepress/entry/author/author-1')).toBe('\0virtual:forgepress/entry/author/author-1')
    expect(resolveId('some/other/module')).toBeUndefined()
  })

  it('builds a collection list from its entry modules', async () => {
    const code = await loader('serve').load('\0virtual:forgepress/list/author')

    expect(code).toContain('import entry0 from "virtual:forgepress/entry/author/author-1"')
    expect(code).toContain('export default [entry0]')
  })

  it('turns an entry file into data without running it', async () => {
    const code = await loader('build').load('\0virtual:forgepress/entry/author/author-1')

    expect(code).toBe('export default {"id":"author-1","status":"published","createdAt":"2024-01-01T00:00:00Z","updatedAt":"2024-01-01T00:00:00Z","name":"Alice"}\n')
  })

  it('refuses entries that do not exist', async () => {
    await expect(loader('build').load('\0virtual:forgepress/entry/author/../../schema'))
      .rejects
      .toThrow('[forgepress] there is no entry "author/../../schema"')
  })

  it('treats an unknown collection as empty', async () => {
    expect(await loader('serve').load('\0virtual:forgepress/list/missing')).toBe('export default []\n')
  })
})

describe('lazy store', () => {
  it('does not select a store until something is read or written', () => {
    let selected = 0

    lazyStore(async () => {
      selected += 1

      return spy()
    })

    expect(selected).toBe(0)
  })

  it('selects a store once across many calls', async () => {
    let selected = 0

    const store = lazyStore(async () => {
      selected += 1

      return spy()
    })

    await store.list('hero')
    await store.list('author')
    await store.writeContent('hero', [])

    expect(selected).toBe(1)
  })

  it('delegates every method to the selected store', async () => {
    const target = spy()
    const store = lazyStore(async () => target)

    await store.schema()
    await store.list('hero')
    await store.index('hero')
    await store.entry('hero', 'a')
    await store.writeSchema({ collections: {}, locales: [] })
    await store.writeEntry('hero', { id: 'a', status: 'unpublished', createdAt: '', updatedAt: '' })
    await store.removeEntry('hero', 'a')
    await store.writeContent('hero', [])
    await store.removeCollection('author')

    expect(target.calls).toEqual([
      'schema',
      'list:hero',
      'index:hero',
      'entry:hero/a',
      'writeSchema',
      'writeEntry:hero/a',
      'removeEntry:hero/a',
      'writeContent:hero',
      'removeCollection:author',
    ])
  })
})
