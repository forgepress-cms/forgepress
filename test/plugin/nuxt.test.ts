import type { Nuxt } from '../../src/plugin/nuxt'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import forgepress from '../../src/plugin/nuxt'

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-nuxt-test', import.meta.url))

function write(path: string, text: string): void {
  mkdirSync(join(scratch, path, '..'), { recursive: true })
  writeFileSync(join(scratch, path), text)
}

function nuxt(options: Partial<Nuxt['options']> = {}) {
  const hooks = new Map<string, (context: never) => void>()
  const instance: Nuxt = {
    options: {
      rootDir: join(scratch, 'site'),
      buildDir: join(scratch, 'site/.nuxt'),
      plugins: [],
      build: { templates: [] },
      ...options,
    },
    hook: (name, handler) => hooks.set(name, handler as (context: never) => void),
  }

  function call<TContext>(name: string, context: TContext): TContext {
    hooks.get(name)!(context as never)

    return context
  }

  return { instance, call }
}

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('nuxt module', () => {
  it('adds the Vite plugin once for the whole app', async () => {
    write('site/package.json', '{}\n')
    const { instance, call } = nuxt()

    await forgepress({}, instance)

    const { config } = call('vite:extend', { config: {} as { plugins?: { name: string }[] } })

    expect(config.plugins?.map(plugin => plugin.name)).toEqual(['unplugin-forgepress'])
  })

  it('lets TypeScript see the schema and the entries, wherever the content folder is', async () => {
    write('site/forgepress.config.mjs', 'export default { path: \'../.forgepress\' }\n')
    const { instance, call } = nuxt()

    await forgepress({}, instance)

    expect(call('prepare:types', { tsConfig: { include: ['./nuxt.d.ts'] } }).tsConfig.include).toEqual(['./nuxt.d.ts', '../../.forgepress/**/*.ts'])
  })

  it('runs the preview plugin in the browser unless it is switched off', async () => {
    write('site/package.json', '{}\n')
    const on = nuxt()
    const off = nuxt({ forgepress: { preview: false } })

    await forgepress({}, on.instance)
    await forgepress({}, off.instance)

    const [template] = on.instance.options.build.templates as { filename: string, getContents: () => string }[]

    expect(template?.filename).toBe('forgepress/preview.client.mjs')
    expect(template?.getContents()).toContain('usePreviewMode({ shouldEnable: previewing })')
    expect(on.instance.options.plugins).toEqual([{ src: join(scratch, 'site/.nuxt/forgepress/preview.client.mjs'), mode: 'client' }])
    expect(off.instance.options.build.templates).toEqual([])
    expect(off.instance.options.plugins).toEqual([])
  })

  it('takes options inline over the forgepress key and resolves the root from the Nuxt root', async () => {
    write('content/forgepress.config.mjs', 'export default {}\n')
    const { instance, call } = nuxt({ forgepress: { preview: false, root: 'elsewhere' } })

    await forgepress({ root: '../content' }, instance)

    expect(call('prepare:types', { tsConfig: {} as { include?: string[] } }).tsConfig.include).toEqual(['../../content/.forgepress/**/*.ts'])
    expect(instance.options.plugins).toEqual([])
  })

  it('names its configuration key', async () => {
    expect(await forgepress.getMeta()).toEqual({ name: 'forgepress', configKey: 'forgepress' })
  })
})
