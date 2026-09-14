import type { UnpluginContextMeta } from 'unplugin'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { unpluginFactory } from '../../src/unplugin'

const root = fileURLToPath(new URL('../fixtures/project', import.meta.url))
const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-store-test', import.meta.url))

function loader(command: 'serve' | 'build', write?: false, base = root) {
  const created = unpluginFactory(write === false ? { root: base, write } : { root: base }, { framework: 'vite' } as UnpluginContextMeta)
  const plugin = Array.isArray(created) ? created[0]! : created

  const configResolved = (plugin.vite as { configResolved: (config: { command: string, root: string }) => void }).configResolved
  const load = plugin.load as unknown as (id: string) => Promise<string> | string
  const resolveId = plugin.resolveId as unknown as (id: string) => string | undefined

  configResolved({ command, root: base })

  return { load: async (id: string) => await load(id) ?? '', resolveId }
}

async function generated(command: 'serve' | 'build', write?: false): Promise<string> {
  return loader(command, write).load('\0virtual:forgepress/content')
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
      .toThrow('[forgepress] there is no published entry "author/../../schema"')
  })

  it('treats an unknown collection as empty', async () => {
    expect(await loader('serve').load('\0virtual:forgepress/list/missing')).toBe('export default []\n')
  })
})

describe('unpublished entries', () => {
  afterAll(() => rmSync(scratch, { recursive: true, force: true }))

  it.each(['serve', 'build'] as const)('stay out of the content graph (%s)', async (command) => {
    const code = await generated(command)

    expect(code).toContain('"author-1": () => import("virtual:forgepress/entry/author/author-1")')
    expect(code).not.toContain('author-2')
  })

  it('stay out of the collection list', async () => {
    const code = await loader('build').load('\0virtual:forgepress/list/author')

    expect(code).not.toContain('author-2')
    expect(code).toContain('export default [entry0]')
  })

  it('cannot be loaded as a module', async () => {
    await expect(loader('build').load('\0virtual:forgepress/entry/author/author-2'))
      .rejects
      .toThrow('[forgepress] there is no published entry "author/author-2"')
  })

  it('keeps an entry that cannot be parsed, so loading it reports where', async () => {
    mkdirSync(join(scratch, '.forgepress/content/author'), { recursive: true })
    writeFileSync(join(scratch, '.forgepress/schema.ts'), 'export default { collections: { author: { fields: {} } } }\n')
    writeFileSync(join(scratch, '.forgepress/content/author/author_1.ts'), 'export default { id: someId }\n')

    const { load } = loader('serve', undefined, scratch)

    expect(await load('\0virtual:forgepress/content')).toContain('"author_1": () => import("virtual:forgepress/entry/author/author_1")')

    await expect(load('\0virtual:forgepress/entry/author/author_1'))
      .rejects
      .toThrow('[forgepress] .forgepress/content/author/author_1.ts:1:22 `someId` is not a literal value')
  })
})
