import type { Buffer } from 'node:buffer'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { UnpluginContextMeta } from 'unplugin'
import type { OutputIndex } from '../../src/output/types'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, onTestFinished } from 'vitest'
import { ContentError } from '../../src/files/issues'
import { unpluginFactory } from '../../src/unplugin'

type Middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => void

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-plugin-test', import.meta.url))

const schema = 'export default { collections: { author: { fields: { name: { type: \'text\', index: true }, mentor: { type: \'collection\', collections: [\'author\'], optional: true } } } } }\n'

function author(id: string, fields = `name: '${id}'`): string {
  return `export default { id: '${id}', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', ${fields} }\n`
}

function write(path: string, text: string): void {
  mkdirSync(join(scratch, path, '..'), { recursive: true })
  writeFileSync(join(scratch, path), text)
}

function project(files: Record<string, string> = {}): void {
  rmSync(scratch, { recursive: true, force: true })

  for (const [path, text] of Object.entries({ '.forgepress/schema.ts': schema, '.forgepress/content/author/alice.ts': author('alice'), ...files }))
    write(path, text)
}

function index(): OutputIndex {
  return JSON.parse(readFileSync(join(scratch, 'public/content/index.json'), 'utf8')) as OutputIndex
}

function manifestIds(): string[] {
  const found = index().collections.author as { manifest: string }
  const manifest = JSON.parse(readFileSync(join(scratch, 'public/content', found.manifest), 'utf8')) as { entries: { id: string }[] }

  return manifest.entries.map(entry => entry.id)
}

async function until(label: string, check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check())
      return

    await new Promise(resolve => setTimeout(resolve, 20))
  }

  throw new Error(`timed out waiting for ${label}`)
}

function create(command: 'serve' | 'build', options: Parameters<typeof unpluginFactory>[0] = { root: scratch }, root = scratch) {
  const created = unpluginFactory(options, { framework: 'vite' } as UnpluginContextMeta)
  const plugin = Array.isArray(created) ? created[0]! : created
  const vite = plugin.vite as {
    configResolved: (config: { command: string, root: string, publicDir: string }) => void
    configureServer: (server: unknown) => Promise<void>
  }

  vite.configResolved({ command, root, publicDir: join(scratch, 'public') })

  return { vite, buildStart: plugin.buildStart as unknown as () => Promise<void> }
}

async function serve() {
  const { vite } = create('serve')
  const middlewares: Middleware[] = []
  const watchers = new Map<string, (file: string) => void>()
  const messages: unknown[] = []
  const warnings: string[] = []

  await vite.configureServer({
    config: { logger: { info: () => {}, warn: (message: string) => warnings.push(message), error: (message: string) => warnings.push(message) } },
    moduleGraph: { getModuleById: () => undefined, invalidateModule: () => {} },
    watcher: { add: () => {}, on: (event: string, handler: (file: string) => void) => watchers.set(event, handler) },
    ws: { send: (payload: unknown) => messages.push(payload) },
    middlewares: { use: (handler: Middleware) => middlewares.push(handler) },
  })

  async function get(url: string, method = 'GET'): Promise<{ status: number, headers: Record<string, string>, body: string } | 'next'> {
    return new Promise((resolve) => {
      const headers: Record<string, string> = {}
      const response = {
        statusCode: 200,
        setHeader: (name: string, value: string) => {
          headers[name.toLowerCase()] = value
        },
        end: (body?: Buffer | string) => resolve({ status: response.statusCode, headers, body: body?.toString() ?? '' }),
      }

      middlewares[0]!({ method, url } as IncomingMessage, response as unknown as ServerResponse, () => resolve('next'))
    })
  }

  return { middlewares, watchers, messages, warnings, get }
}

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true })
  delete process.env.FORGEPRESS_OUTPUT
})

describe('dev server', () => {
  it('writes the content output for development before serving', async () => {
    project()
    await serve()

    expect(index()).toMatchObject({ version: 3, commit: null, dev: true })
    expect(manifestIds()).toEqual(['alice'])
    expect(process.env.FORGEPRESS_OUTPUT).toBe(join(scratch, 'public/content'))
  })

  it('writes it again and reloads the page after content changes', async () => {
    project()
    const server = await serve()

    write('.forgepress/content/author/bob.ts', author('bob'))
    server.watchers.get('add')!(join(scratch, '.forgepress/content/author/bob.ts'))
    server.watchers.get('change')!(join(scratch, 'src/app.ts'))

    await until('the reload', () => server.messages.length > 0)

    expect(manifestIds()).toEqual(['alice', 'bob'])
    expect(server.messages).toEqual([{ type: 'full-reload' }])
  })

  it('keeps the site working while content has problems, and warns', async () => {
    project({
      '.forgepress/content/author/bob.ts': author('bob', 'name: \'Bob\', mentor: \'nobody\''),
      '.forgepress/content/author/carol.ts': 'export default { id: carol }\n',
    })
    const server = await serve()

    expect(manifestIds()).toEqual(['alice', 'bob'])
    expect(server.warnings.join('\n')).toContain('Field "mentor" references author/nobody, which doesn\'t exist')
    expect(server.warnings.join('\n')).toContain('carol.ts:1:22 `carol` is not a literal value')
  })

  it('keeps the last output while the schema is broken', async () => {
    project()
    const server = await serve()
    const before = readdirSync(join(scratch, 'public/content'), { recursive: true })

    write('.forgepress/schema.ts', 'export default { collections: { author: { fields: { name: { type: \'colour\' } } } } }\n')
    server.watchers.get('change')!(join(scratch, '.forgepress/schema.ts'))
    await until('the reload', () => server.messages.length > 0)

    expect(readdirSync(join(scratch, 'public/content'), { recursive: true })).toEqual(before)
    expect(server.warnings.join('\n')).toContain('has unknown type "colour"')
  })

  it('starts without a schema, and keeps the types in step with it', async () => {
    rmSync(scratch, { recursive: true, force: true })
    write('package.json', '{}\n')
    const server = await serve()

    expect(index()).toMatchObject({ collections: {} })
    expect(server.warnings).toEqual([])
    expect(existsSync(join(scratch, '.forgepress'))).toBe(false)

    write('.forgepress/schema.ts', schema)
    write('.forgepress/content/author/alice.ts', author('alice'))
    server.watchers.get('add')!(join(scratch, '.forgepress/schema.ts'))
    await until('the reload', () => server.messages.length > 0)

    expect(manifestIds()).toEqual(['alice'])
    expect(existsSync(join(scratch, '.forgepress/forgepress.d.ts'))).toBe(true)

    server.messages.length = 0
    rmSync(join(scratch, '.forgepress/schema.ts'))
    server.watchers.get('unlink')!(join(scratch, '.forgepress/schema.ts'))
    await until('the second reload', () => server.messages.length > 0)

    expect(existsSync(join(scratch, '.forgepress/forgepress.d.ts'))).toBe(false)
  })

  it('serves the output files itself, so a new file is there right after writing it', async () => {
    project()
    const { get } = await serve()
    const manifest = (index().collections.author as { manifest: string }).manifest

    expect(await get('/content/index.json?t=1')).toMatchObject({ status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-cache' }, body: readFileSync(join(scratch, 'public/content/index.json'), 'utf8') })
    expect(await get(`/content/${manifest}`)).toMatchObject({ status: 200 })
    expect(await get('/content/author/index.00000000.json')).toMatchObject({ status: 404 })
    expect(await get('/content/..%2F..%2F.forgepress%2Fschema.ts')).toMatchObject({ status: 404 })
    expect(await get('/content/index.json', 'POST')).toBe('next')
    expect(await get('/uploads/photo.png')).toBe('next')
  })

  it('leaves serving to others when the output is outside the public folder', async () => {
    project({ 'forgepress.config.mjs': 'export default { output: { dir: \'data/content\' } }\n' })
    const { middlewares } = await serve()

    expect(existsSync(join(scratch, 'data/content/index.json'))).toBe(true)
    expect(middlewares).toHaveLength(1)
  })
})

describe('build', () => {
  it('writes the content output with the commit before bundling', async () => {
    project()
    await create('build').buildStart()

    expect(index()).toMatchObject({ version: 3, commit: expect.stringMatching(/^[\da-f]{40}$/) })
    expect(index().dev).toBeUndefined()
    expect(existsSync(join(scratch, '.forgepress/forgepress.d.ts'))).toBe(true)
    expect(process.env.FORGEPRESS_OUTPUT).toBe(join(scratch, 'public/content'))
  })

  it('builds a project without a schema, and writes no types for it', async () => {
    rmSync(scratch, { recursive: true, force: true })
    write('package.json', '{}\n')
    await create('build').buildStart()

    expect(index()).toMatchObject({ version: 3, collections: {} })
    expect(existsSync(join(scratch, '.forgepress'))).toBe(false)
  })

  it('finds the project above the Vite root, like app/ in a Nuxt project', async () => {
    const site = mkdtempSync(join(tmpdir(), 'forgepress-vite-root-'))

    onTestFinished(() => rmSync(site, { recursive: true, force: true }))
    mkdirSync(join(site, 'app'))
    writeFileSync(join(site, 'package.json'), '{}\n')
    writeFileSync(join(site, 'app/app.vue'), '<template />\n')
    await create('build', {}, join(site, 'app')).buildStart()

    expect(JSON.parse(readFileSync(join(site, 'public/content/index.json'), 'utf8'))).toMatchObject({ collections: {} })
    expect(existsSync(join(site, 'app/.forgepress'))).toBe(false)
    expect(existsSync(join(site, 'app/public'))).toBe(false)
  })

  it('fails and writes nothing while content has problems', async () => {
    project({ '.forgepress/content/author/bob.ts': author('bob', 'name: \'Bob\', mentor: \'nobody\'') })

    await expect(create('build').buildStart()).rejects.toBeInstanceOf(ContentError)
    expect(existsSync(join(scratch, 'public/content'))).toBe(false)
  })
})
