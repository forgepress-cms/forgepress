import type { UnpluginContextMeta } from 'unplugin'
import type { ContentStore } from '../src/types/content/store'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { lazyStore } from '../src/content/store'
import { unpluginFactory } from '../src/unplugin'

const root = fileURLToPath(new URL('./fixtures/project', import.meta.url))

async function generated(command: 'serve' | 'build', write?: false): Promise<string> {
  const created = unpluginFactory(write === false ? { root, write } : { root }, { framework: 'vite' } as UnpluginContextMeta)
  const plugin = Array.isArray(created) ? created[0]! : created

  const configResolved = (plugin.vite as { configResolved: (config: { command: string, root: string }) => void }).configResolved
  const load = plugin.load as unknown as (id: string) => Promise<string> | string

  configResolved({ command, root })

  return await load('\0virtual:webenv/content') ?? ''
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

      return { components: {}, locales: [] }
    },
    list: async (component) => {
      calls.push(`list:${component}`)

      return []
    },
    writeSchema: async () => {
      calls.push('writeSchema')
    },
    writeContent: async (component) => {
      calls.push(`writeContent:${component}`)
    },
    removeContent: async (component) => {
      calls.push(`removeContent:${component}`)
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

    expect(code).toContain('export { default as schema }')
    expect(code).toContain('"blogPost"')
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
    await store.writeSchema({ components: {}, locales: [] })
    await store.writeContent('hero', [])
    await store.removeContent('author')

    expect(target.calls).toEqual(['schema', 'list:hero', 'writeSchema', 'writeContent:hero', 'removeContent:author'])
  })
})
