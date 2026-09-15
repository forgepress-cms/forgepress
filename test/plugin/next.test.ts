import type { NextConfig, NextWebpackConfig } from '../../src/plugin/next'
import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { ContentError } from '../../src/files/issues'
import { withForgePress } from '../../src/plugin/next'

const scratch = fileURLToPath(new URL('../../node_modules/.forgepress-next-test', import.meta.url))
const source = fileURLToPath(new URL('../../src', import.meta.url))

const schema = 'export default { collections: { author: { fields: { name: { type: \'text\', index: true } } } } }\n'

let projects = 0

function author(id: string, fields = `name: '${id}'`): string {
  return `export default { id: '${id}', status: 'published', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', ${fields} }\n`
}

function project(files: Record<string, string> = { '.forgepress/schema.ts': schema, '.forgepress/content/author/alice.ts': author('alice') }): string {
  projects += 1

  const root = join(scratch, `project-${projects}`)

  for (const [path, text] of Object.entries({ 'package.json': '{}\n', ...files })) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), text)
  }

  return root
}

function manifestIds(root: string): string[] {
  const index = JSON.parse(readFileSync(join(root, 'public/content/index.json'), 'utf8')) as { collections: { author: { manifest: string } } }
  const manifest = JSON.parse(readFileSync(join(root, 'public/content', index.collections.author.manifest), 'utf8')) as { entries: { id: string }[] }

  return manifest.entries.map(entry => entry.id)
}

async function until(label: string, check: () => boolean, timeout = 10000): Promise<void> {
  const start = Date.now()

  while (!check()) {
    if (Date.now() - start > timeout)
      throw new Error(`timed out waiting for ${label}`)

    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

type LoadedConfig = NextConfig & { output?: string, rewrites?: () => Promise<unknown> }

interface Answer {
  status: number
  allowed: string | undefined
  text: string
}

async function load(phase: string, config: LoadedConfig | (() => Promise<LoadedConfig>), options: { root: string, write?: boolean, preview?: boolean }): Promise<LoadedConfig> {
  const project = async (): Promise<LoadedConfig> => {
    const found = typeof config === 'function' ? await config() : config

    return { ...found, typescript: { tsconfigPath: join(options.root, 'tsconfig.json'), ...found.typescript } }
  }

  return withForgePress(project, options)(phase, { defaultConfig: {} })
}

function settings(config: NextConfig): unknown {
  return JSON.parse(String(config.compiler?.define?.__FORGEPRESS_SETTINGS__))
}

function devServer(config: NextConfig): string {
  return (settings(config) as { devServer: string }).devServer
}

function send(url: string, { method = 'GET', body, ...headers }: Record<string, string> = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    request(url, { method, headers }, (response) => {
      const chunks: Buffer[] = []

      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode ?? 0, allowed: response.headers['access-control-allow-origin'], text: Buffer.concat(chunks).toString('utf8') }))
    }).on('error', reject).end(body)
  })
}

function upgrade(url: string, origin: string): Promise<number> {
  return new Promise((resolve) => {
    const outgoing = request(url, { headers: { 'connection': 'Upgrade', 'upgrade': 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', 'sec-websocket-version': '13', origin } })

    outgoing.on('upgrade', (response, socket) => {
      socket.destroy()
      resolve(response.statusCode ?? 0)
    })

    outgoing.on('response', (response) => {
      response.resume()
      resolve(response.statusCode ?? 0)
    })

    outgoing.on('error', () => resolve(0))
    outgoing.end()
  })
}

class ReplacementPlugin {
  readonly pattern: RegExp
  readonly request: string

  constructor(pattern: RegExp, request: string) {
    this.pattern = pattern
    this.request = request
  }
}

afterEach(() => {
  delete process.env.FORGEPRESS_OUTPUT
  vi.restoreAllMocks()
})

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true })
})

describe('next build', () => {
  it('bakes the editor settings, points Next at them and writes the types', async () => {
    const root = project()
    const config = await load('phase-production-build', { output: 'export' }, { root })

    expect(config.output).toBe('export')
    expect(settings(config)).toEqual({
      local: false,
      devServer: '',
      provider: null,
      format: null,
      contentPath: '.forgepress',
      media: { dir: 'public/uploads', url: '/uploads', maxSize: 8388608 },
    })
    expect(config.compiler?.define).toMatchObject({ __VUE_OPTIONS_API__: true, __VUE_PROD_DEVTOOLS__: false, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false })
    expect(config.turbopack?.resolveAlias).toEqual({ 'virtual:forgepress/settings': 'forgepress/next/settings' })
    expect(config.instrumentationClientInject).toEqual(['forgepress/next/preview'])
    expect(config.rewrites).toBeUndefined()
    expect(process.env.FORGEPRESS_OUTPUT).toBe(join(root, 'public/content'))
    expect(existsSync(join(root, '.forgepress/forgepress.d.ts'))).toBe(true)
  })

  it('writes the content output once Next has compiled, before it type checks and renders pages', async () => {
    const root = project()
    const order: string[] = []
    const config = await load('phase-production-build', {
      compiler: {
        runAfterProductionCompile: async () => {
          order.push(existsSync(join(root, 'public/content/index.json')) ? 'own hook after the output' : 'own hook before the output')
        },
      },
    }, { root })

    expect(existsSync(join(root, 'public/content'))).toBe(false)

    await config.compiler?.runAfterProductionCompile?.({ projectDir: root, distDir: join(root, '.next') })

    expect(manifestIds(root)).toEqual(['alice'])
    expect(order).toEqual(['own hook after the output'])
  })

  it('fails the build while content has problems', async () => {
    const root = project({ '.forgepress/schema.ts': schema, '.forgepress/content/author/bob.ts': author('bob', 'name: 1') })
    const config = await load('phase-production-build', {}, { root })

    await expect(config.compiler?.runAfterProductionCompile?.({ projectDir: root, distDir: join(root, '.next') })).rejects.toBeInstanceOf(ContentError)
    expect(existsSync(join(root, 'public/content'))).toBe(false)
  })

  it('keeps what the project configured itself', async () => {
    const root = project()
    const own = vi.fn((config: NextWebpackConfig) => ({ ...config, plugins: ['own'] }))
    const config = await load('phase-production-build', async () => ({
      compiler: { define: { __VUE_OPTIONS_API__: false, RELEASE: 'v1' } },
      turbopack: { resolveAlias: { lodash: 'lodash-es' } },
      instrumentationClientInject: ['./analytics.ts'],
      webpack: own,
    }), { root, preview: false })

    expect(config.compiler?.define).toMatchObject({ __VUE_OPTIONS_API__: false, RELEASE: 'v1' })
    expect(config.turbopack?.resolveAlias).toEqual({ 'lodash': 'lodash-es', 'virtual:forgepress/settings': 'forgepress/next/settings' })
    expect(config.instrumentationClientInject).toEqual(['./analytics.ts'])

    const webpack = config.webpack?.({ plugins: [] }, { webpack: { NormalModuleReplacementPlugin: ReplacementPlugin } }) as Required<NextWebpackConfig>
    const [ignored] = webpack.ignoreWarnings as ((warning: { message: string, module: { resource: string } }) => boolean)[]
    const message = 'Critical dependency: the request of a dependency is an expression'

    expect(own).toHaveBeenCalledOnce()
    expect(webpack.plugins).toEqual(['own', new ReplacementPlugin(/^virtual:forgepress\/settings$/, 'forgepress/next/settings')])
    expect(ignored?.({ message, module: { resource: join(source, 'disk/config.ts') } })).toBe(true)
    expect(ignored?.({ message, module: { resource: join(root, 'app/page.tsx') } })).toBe(false)
    expect(ignored?.({ message: 'Module not found', module: { resource: join(source, 'disk/config.ts') } })).toBe(false)
  })

  it('adds the content folder to the TypeScript project when the default globs skip it, keeping the formatting', async () => {
    const root = project({ 'forgepress.config.mjs': 'export default { path: \'../.forgepress\' }\n', 'tsconfig.json': '{\n  "compilerOptions": { "strict": true },\n  "include": [\n    "next-env.d.ts",\n    "**/*.ts"\n  ],\n  "exclude": ["node_modules"]\n}\n' })
    const inline = project({ 'tsconfig.json': '{ "include": [ "**/*.ts" ] }\n' })
    const tsconfig = join(root, 'tsconfig.json')
    const log = vi.spyOn(process.stdout, 'write').mockReturnValue(true)

    await load('phase-production-build', { typescript: { tsconfigPath: tsconfig } }, { root })
    await load('phase-development-server', { typescript: { tsconfigPath: tsconfig } }, { root, write: false })
    await withForgePress({}, { root: inline })('phase-production-build', { defaultConfig: {} })

    expect(readFileSync(tsconfig, 'utf8')).toBe('{\n  "compilerOptions": { "strict": true },\n  "include": [\n    "next-env.d.ts",\n    "**/*.ts",\n    "../.forgepress/**/*.ts"\n  ],\n  "exclude": ["node_modules"]\n}\n')
    expect(readFileSync(join(inline, 'tsconfig.json'), 'utf8')).toBe('{ "include": [ "**/*.ts", ".forgepress/**/*.ts" ] }\n')
    expect(log).toHaveBeenCalledWith('[forgepress] added "../.forgepress/**/*.ts" to "include" in tsconfig.json, so TypeScript knows the schema\n')
    expect(log).toHaveBeenCalledTimes(2)
  })

  it('asks for the include instead of editing a tsconfig it cannot edit safely, and leaves visible folders alone', async () => {
    const commented = project({ 'tsconfig.json': '{\n  // Next.js\n  "include": ["**/*.ts"]\n}\n' })
    const bracket = project({ 'tsconfig.json': '{ "include": ["[a]/**/*.ts"] }\n' })
    const visible = project({ 'forgepress.config.mjs': 'export default { path: \'content\' }\n', 'tsconfig.json': '{ "include": ["**/*.ts"] }\n' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await load('phase-production-build', { typescript: { tsconfigPath: join(commented, 'tsconfig.json') } }, { root: commented })
    await load('phase-production-build', { typescript: { tsconfigPath: join(bracket, 'tsconfig.json') } }, { root: bracket })
    await load('phase-production-build', { typescript: { tsconfigPath: join(visible, 'tsconfig.json') } }, { root: visible })

    expect(warn).toHaveBeenCalledWith('[forgepress] add ".forgepress/**/*.ts" to "include" in tsconfig.json, so TypeScript knows the schema')
    expect(warn).toHaveBeenCalledTimes(2)
    expect(readFileSync(join(commented, 'tsconfig.json'), 'utf8')).toContain('// Next.js')
    expect(readFileSync(join(bracket, 'tsconfig.json'), 'utf8')).toBe('{ "include": ["[a]/**/*.ts"] }\n')
    expect(readFileSync(join(visible, 'tsconfig.json'), 'utf8')).toBe('{ "include": ["**/*.ts"] }\n')
  })
})

describe('next dev', { timeout: 15000 }, () => {
  it('writes the output before Next serves, and tells the editor where the dev server is', async () => {
    const root = project()
    const config = await load('phase-development-server', { output: 'export' }, { root })
    const again = await load('phase-development-server', { output: 'export' }, { root })
    const server = devServer(config)

    expect(settings(config)).toMatchObject({ local: true, devServer: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/) })
    expect(devServer(again)).toBe(server)
    expect(config.instrumentationClientInject).toEqual(['forgepress/next/preview', 'forgepress/next/reload'])
    expect(config.rewrites).toBeUndefined()
    expect(manifestIds(root)).toEqual(['alice'])

    const response = await fetch(`${server}/__forgepress/content/author`)

    expect(await response.json()).toMatchObject([{ id: 'alice' }])
    expect(await send(`${server}/__forgepress/schema`, { host: 'evil.test' })).toEqual({ status: 403, allowed: undefined, text: '' })
  })

  it('answers pages opened on localhost, and only them', async () => {
    const root = project()
    const server = devServer(await load('phase-development-server', {}, { root }))
    const site = 'http://localhost:3000'
    const preflight = await send(`${server}/__forgepress/entry/author/carol`, { 'method': 'OPTIONS', 'origin': site, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' })

    expect(preflight).toEqual({ status: 204, allowed: site, text: '' })
    expect(await send(`${server}/__forgepress/schema`, { 'origin': site, 'sec-fetch-site': 'cross-site' })).toMatchObject({ status: 200, allowed: site })
    expect(await send(`${server}/__forgepress/schema`, { origin: 'http://blog.localhost:5173' })).toMatchObject({ status: 200 })
    expect(await send(`${server}/__forgepress/schema`, { origin: 'https://[::1]:3000' })).toMatchObject({ status: 200 })
    expect(await send(`${server}/__forgepress/schema`, { 'sec-fetch-site': 'none' })).toMatchObject({ status: 200 })
    expect(await send(`${server}/__forgepress/schema`)).toMatchObject({ status: 200 })

    const refusal = { status: 403, text: 'the dev endpoint only accepts requests from pages opened on localhost' }

    for (const origin of ['https://attacker.example', 'http://192.168.1.20:3000', 'http://localhost.attacker.example', 'null'])
      expect(await send(`${server}/__forgepress/schema`, { origin })).toEqual({ ...refusal, allowed: origin })

    expect(await send(`${server}/__forgepress/entry/author/carol`, { 'method': 'OPTIONS', 'origin': 'https://attacker.example', 'access-control-request-method': 'POST' })).toMatchObject(refusal)
    expect(await send(`${server}/__forgepress/entry/author/carol`, { method: 'POST', origin: 'https://attacker.example', body: author('carol') })).toMatchObject(refusal)
    expect(await send(`${server}/__forgepress/schema`, { 'sec-fetch-site': 'cross-site' })).toMatchObject({ status: 403 })
    expect(existsSync(join(root, '.forgepress/content/author/carol.ts'))).toBe(false)
  })

  it('reloads open pages after content changes on disk or through the endpoint', async () => {
    const root = project()
    const server = devServer(await load('phase-development-server', {}, { root }))
    const messages: unknown[] = []
    const socket = new WebSocket(`${server.replace('http', 'ws')}/__forgepress/events`)

    socket.addEventListener('message', event => messages.push(event.data))
    await new Promise(resolve => socket.addEventListener('open', resolve))

    writeFileSync(join(root, '.forgepress/content/author/bob.ts'), author('bob'))
    await until('the reload after a file change', () => messages.length > 0)

    expect(messages).toEqual(['reload'])
    expect(manifestIds(root)).toEqual(['alice', 'bob'])

    await fetch(`${server}/__forgepress/entry/author/carol`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'carol', status: 'published', createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z', name: 'Carol' }),
    })
    await until('the reload after a write', () => manifestIds(root).includes('carol') && messages.length > 1)

    socket.close()
  })

  it('refuses reload connections from pages that are not on localhost', async () => {
    const root = project()
    const server = devServer(await load('phase-development-server', {}, { root }))

    expect(await upgrade(`${server}/__forgepress/events`, 'http://localhost:3000')).toBe(101)
    expect(await upgrade(`${server}/__forgepress/events`, 'https://attacker.example')).toBe(0)
    expect(await upgrade(`${server}/__forgepress/other`, 'http://localhost:3000')).toBe(0)
  })

  it('picks up a content folder created while dev runs', async () => {
    const root = project({})
    const server = devServer(await load('phase-development-server', {}, { root }))
    const messages: unknown[] = []
    const socket = new WebSocket(`${server.replace('http', 'ws')}/__forgepress/events`)

    socket.addEventListener('message', event => messages.push(event.data))
    await new Promise(resolve => socket.addEventListener('open', resolve))

    mkdirSync(join(root, '.forgepress/content/author'), { recursive: true })
    writeFileSync(join(root, '.forgepress/schema.ts'), schema)
    writeFileSync(join(root, '.forgepress/content/author/alice.ts'), author('alice'))
    await until('the new content', () => messages.length > 0 && existsSync(join(root, '.forgepress/forgepress.d.ts')))

    expect(manifestIds(root)).toEqual(['alice'])

    socket.close()
  })

  it('leaves the rewrites of the project alone, and refuses writes when writing is off', async () => {
    const root = project()
    const rewrites = async () => [{ source: '/blog/:slug', destination: '/posts/:slug' }]
    const config = await load('phase-development-server', { rewrites }, { root, write: false })

    expect(settings(config)).toMatchObject({ local: false })
    expect(config.rewrites).toBe(rewrites)
    expect((await fetch(`${devServer(config)}/__forgepress/schema`)).status).toBe(404)
  })
})
