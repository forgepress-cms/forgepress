import type { ModuleOptions } from '../../src/plugin/nuxt'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runWithNuxtContext } from '@nuxt/kit'
import { afterEach, describe, expect, it } from 'vitest'
import forgepress from '../../src/plugin/nuxt'

type Nuxt = Parameters<typeof forgepress>[1]

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-nuxt-test', import.meta.url))

function write(path: string, text: string): void {
  mkdirSync(join(scratch, path, '..'), { recursive: true })
  writeFileSync(join(scratch, path), text)
}

function nuxt(options: { forgepress?: ModuleOptions } = {}) {
  const hooks = new Map<string, (context: never) => unknown>()
  const instance = {
    options: {
      rootDir: join(scratch, 'site'),
      buildDir: join(scratch, 'site/.nuxt'),
      alias: {},
      plugins: [],
      build: { templates: [] },
      ...options,
    },
    hook: (name: string, handler: (context: never) => unknown) => hooks.set(name, handler),
  } as unknown as Nuxt

  async function install(inline: ModuleOptions = {}): Promise<void> {
    await runWithNuxtContext(instance, () => forgepress(inline, instance))
  }

  async function call<TContext>(name: string, context: TContext): Promise<TContext> {
    await hooks.get(name)!(context as never)

    return context
  }

  return { instance, install, call }
}

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('nuxt module', () => {
  it('adds the Vite plugin once for the whole app', async () => {
    write('site/package.json', '{}\n')
    const { install, call } = nuxt()

    await install()

    const { config } = await call('vite:extend', { config: {} as { plugins?: { name: string }[] } })

    expect(config.plugins?.map(plugin => plugin.name)).toEqual(['unplugin-forgepress'])
  })

  it('lets TypeScript see the schema and the entries, wherever the content folder is, and the config next to nuxt.config', async () => {
    write('site/forgepress.config.ts', 'export default { path: \'../.forgepress\' }\n')
    const { install, call } = nuxt()

    await install()

    const types = await call('prepare:types', { tsConfig: { include: ['./nuxt.d.ts'] }, nodeTsConfig: { include: ['../nuxt.config.*'] } })

    expect(types.tsConfig.include).toEqual(['./nuxt.d.ts', '../../.forgepress/**/*.ts'])
    expect(types.nodeTsConfig.include).toEqual(['../nuxt.config.*', '../forgepress.config.ts'])
  })

  it('runs the preview plugin in the browser unless it is switched off', async () => {
    write('site/package.json', '{}\n')
    const on = nuxt()
    const off = nuxt({ forgepress: { preview: false } })

    await on.install()
    await off.install()

    const [template] = on.instance.options.build.templates as { filename: string, getContents: () => string }[]

    expect(template?.filename).toBe('forgepress/preview.client.mjs')
    expect(template?.getContents()).toContain('usePreviewMode({ shouldEnable: previewing })')
    expect(on.instance.options.plugins).toMatchObject([{ src: join(scratch, 'site/.nuxt/forgepress/preview.client.mjs'), mode: 'client' }])
    expect(off.instance.options.build.templates).toEqual([])
    expect(off.instance.options.plugins).toEqual([])
  })

  it('takes options inline over the forgepress key and resolves the root from the Nuxt root', async () => {
    write('content/forgepress.config.mjs', 'export default {}\n')
    const { instance, install, call } = nuxt({ forgepress: { preview: false, root: 'elsewhere' } })

    await install({ root: '../content' })

    const types = await call('prepare:types', { tsConfig: {} as { include?: string[] }, nodeTsConfig: {} as { include?: string[] } })

    expect(types.tsConfig.include).toEqual(['../../content/.forgepress/**/*.ts'])
    expect(types.nodeTsConfig.include).toEqual(['../../content/forgepress.config.mjs'])
    expect(instance.options.plugins).toEqual([])
  })

  it('names its configuration key', async () => {
    expect(await forgepress.getMeta?.()).toEqual({ name: 'forgepress', configKey: 'forgepress' })
  })
})
