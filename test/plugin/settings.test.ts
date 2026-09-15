import type { UnpluginContextMeta } from 'unplugin'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { unpluginFactory } from '../../src/unplugin'

const root = fileURLToPath(new URL('../fixtures/project', import.meta.url))

function plugin(command: 'serve' | 'build', write?: false) {
  const created = unpluginFactory(write === false ? { root, write } : { root }, { framework: 'vite' } as UnpluginContextMeta)
  const found = Array.isArray(created) ? created[0]! : created

  ;(found.vite as { configResolved: (config: { command: string, root: string }) => void }).configResolved({ command, root })

  return {
    load: async (id: string): Promise<string> => await (found.load as unknown as (id: string) => Promise<string | undefined>)(id) ?? '',
    resolveId: found.resolveId as unknown as (id: string) => string | undefined,
  }
}

describe('editor settings module', () => {
  it('resolves only its own id', () => {
    const { resolveId } = plugin('serve')

    expect(resolveId('virtual:forgepress/settings')).toBe('\0virtual:forgepress/settings')
    expect(resolveId('virtual:forgepress/content')).toBeUndefined()
    expect(resolveId('some/other/module')).toBeUndefined()
  })

  it('tells the editor whether it runs against the dev server', async () => {
    expect(await plugin('serve').load('\0virtual:forgepress/settings')).toContain('export const local = true')
    expect(await plugin('build').load('\0virtual:forgepress/settings')).toContain('export const local = false')
    expect(await plugin('serve', false).load('\0virtual:forgepress/settings')).toContain('export const local = false')
  })

  it('holds the editor settings but no content', async () => {
    const code = await plugin('build').load('\0virtual:forgepress/settings')

    expect(code).toBe([
      'export const local = false',
      'export const devServer = ""',
      'export const provider = null',
      'export const format = null',
      'export const contentPath = ".forgepress"',
      'export const media = {"dir":"public/uploads","url":"/uploads","maxSize":8388608}',
      '',
    ].join('\n'))
  })
})
