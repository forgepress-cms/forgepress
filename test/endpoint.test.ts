import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { UnpluginContextMeta } from 'unplugin'
import { Buffer } from 'node:buffer'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request as send } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reader, writer } from '../src/editor/endpoint'
import { unpluginFactory } from '../src/unplugin'

type Middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => void

const scratch = fileURLToPath(new URL('../node_modules/.forgepress-endpoint-test', import.meta.url))

function entry(id: string, status: string, name: string): string {
  return `export default { id: '${id}', status: '${status}', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', name: '${name}' }\n`
}

const files: Record<string, string> = {
  '.forgepress/schema.ts': 'export default { collections: { author: { fields: { name: { type: \'text\' } } } } }\n',
  '.forgepress/content/author/author_1.ts': entry('author_1', 'published', 'Alice'),
  '.forgepress/content/author/author_2.ts': entry('author_2', 'unpublished', 'Bob'),
}

const reloads: unknown[] = []
let server: Server
let base = ''

interface Answer {
  status: number
  text: string
}

function call(method: string, path: string, options: { headers?: Record<string, string>, body?: string } = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const outgoing = send(`${base}/__forgepress${path}`, { method, headers: options.headers ?? {} }, (incoming) => {
      const chunks: Buffer[] = []

      incoming.on('data', (chunk: Buffer) => chunks.push(chunk))
      incoming.on('end', () => resolve({ status: incoming.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }))
    })

    outgoing.on('error', reject)
    outgoing.end(options.body)
  })
}

function exists(path: string): boolean {
  return existsSync(join(scratch, path))
}

function author(id: string): string {
  return JSON.stringify({ id, status: 'unpublished', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', name: 'Eve' })
}

beforeAll(async () => {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(scratch, path, '..'), { recursive: true })
    writeFileSync(join(scratch, path), text)
  }

  const created = unpluginFactory({ root: scratch }, { framework: 'vite' } as UnpluginContextMeta)
  const plugin = Array.isArray(created) ? created[0]! : created
  const vite = plugin.vite as {
    configResolved: (config: { command: string, root: string }) => void
    configureServer: (server: unknown) => Promise<void>
  }

  let middleware: Middleware = (_request, _response, next) => next()

  vite.configResolved({ command: 'serve', root: scratch })

  await vite.configureServer({
    config: { logger: { info: () => {}, warn: () => {}, error: () => {} } },
    moduleGraph: { idToModuleMap: new Map([['\0virtual:forgepress/content', {}]]), invalidateModule: () => {} },
    watcher: { add: () => {}, on: () => {} },
    ws: { send: (payload: unknown) => reloads.push(payload) },
    middlewares: {
      use: (handler: Middleware) => {
        middleware = handler
      },
    },
  })

  server = createServer((request, response) => middleware(request, response, () => {
    response.statusCode = 404
    response.end()
  }))

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))

  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const fetch = globalThis.fetch

  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => fetch(`${base}${path}`, init))
})

beforeEach(() => {
  reloads.length = 0
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await new Promise(resolve => server.close(resolve))
  rmSync(scratch, { recursive: true, force: true })
})

describe('dev endpoint', () => {
  it('gives the editor the schema', async () => {
    expect(Object.keys((await reader.schema()).collections)).toEqual(['author'])
  })

  it('gives the editor unpublished entries too', async () => {
    expect((await reader.list('author')).map(row => row.id)).toEqual(['author_1', 'author_2'])
    expect((await reader.index('author')).map(meta => meta.status)).toEqual(['published', 'unpublished'])
    expect((await reader.entry('author', 'author_2'))?.name).toBe('Bob')
  })

  it('answers with nothing for entries and collections that do not exist', async () => {
    expect(await reader.entry('author', 'author_9')).toBeUndefined()
    expect(await reader.list('post')).toEqual([])
  })

  it('reads nothing outside the content folder', async () => {
    expect(await reader.list('../..')).toEqual([])
    expect(await reader.entry('author', '../../schema')).toBeUndefined()
    expect(await reader.entry('../author', 'author_1')).toBeUndefined()
  })

  it('reloads the page after writes, not after reads', async () => {
    await reader.list('author')
    await reader.schema()

    expect(reloads).toEqual([])

    await writer.writeEntry('author', { id: 'author_3', status: 'unpublished', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', name: 'Carol' })

    expect(reloads).toEqual([{ type: 'full-reload' }])
    expect((await reader.entry('author', 'author_3'))?.name).toBe('Carol')
  })
})

describe('dev endpoint protection', () => {
  it('refuses requests from pages on other origins', async () => {
    const strangers = [{ 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }, { origin: 'http://attacker.example' }, { origin: 'null' }]

    for (const headers of strangers) {
      expect((await call('POST', '/entry/author/author_7', { headers, body: author('author_7') })).status).toBe(403)
      expect((await call('DELETE', '/entry/author/author_1', { headers })).status).toBe(403)
      expect((await call('GET', '/content/author', { headers })).status).toBe(403)
      expect((await call('POST', '/media/photo.png', { headers, body: 'png' })).status).toBe(403)
    }

    expect(exists('.forgepress/content/author/author_7.ts')).toBe(false)
    expect(exists('.forgepress/content/author/author_1.ts')).toBe(true)
    expect(exists('public/uploads')).toBe(false)
    expect(reloads).toEqual([])
  })

  it('answers its own origin and tools that are not browsers', async () => {
    expect((await call('GET', '/schema', { headers: { 'sec-fetch-site': 'same-origin' } })).status).toBe(200)
    expect((await call('GET', '/schema', { headers: { 'sec-fetch-site': 'none' } })).status).toBe(200)
    expect((await call('GET', '/schema', { headers: { origin: base } })).status).toBe(200)
    expect((await call('GET', '/schema')).status).toBe(200)
  })

  it('refuses names that lead out of the content folder', async () => {
    const escape = encodeURIComponent('../../../escaped')
    const attempts: [method: string, path: string, body?: string][] = [
      ['POST', '/entry/author/x', JSON.stringify({ id: '../../../escaped' })],
      ['POST', `/entry/author/${escape}`, JSON.stringify({ id: '../../../escaped' })],
      ['POST', `/entry/${encodeURIComponent('../..')}/escaped`, author('escaped')],
      ['POST', `/content/${encodeURIComponent('../..')}`, '[]'],
      ['POST', '/content/author', JSON.stringify([JSON.parse(author('author_1')), { id: '../../../escaped' }])],
      ['DELETE', `/entry/author/${encodeURIComponent('../../schema')}`],
      ['DELETE', `/content/${encodeURIComponent('../..')}`],
      ['DELETE', `/media/${encodeURIComponent('../../package.json')}`],
      ['POST', '/media/notes.txt', 'text'],
    ]

    for (const [method, path, body] of attempts)
      expect((await call(method, path, body === undefined ? {} : { body })).status, `${method} ${path}`).toBe(400)

    expect(exists('escaped.ts')).toBe(false)
    expect(exists('.forgepress/schema.ts')).toBe(true)
    expect(readFileSync(join(scratch, '.forgepress/content/author/author_1.ts'), 'utf8')).toBe(files['.forgepress/content/author/author_1.ts'])
    expect(exists('.forgepress/content/author/author_2.ts')).toBe(true)
    expect(reloads).toEqual([])
  })

  it('refuses bodies that are not entries and a schema that does not validate', async () => {
    expect((await call('POST', '/entry/author/author_8', { body: author('author_9') })).status).toBe(400)
    expect((await call('POST', '/entry/author/author_8', { body: '{"id":' })).status).toBe(400)
    expect((await call('POST', '/content/author', { body: author('author_8') })).status).toBe(400)

    const refused = await call('POST', '/schema', { body: JSON.stringify({ collections: { 'Bad Name': { fields: {} } } }) })

    expect(refused).toMatchObject({ status: 400, text: expect.stringContaining('has to start with a lowercase letter') })
    expect(readFileSync(join(scratch, '.forgepress/schema.ts'), 'utf8')).toBe(files['.forgepress/schema.ts'])
    expect(exists('.forgepress/content/author/author_8.ts')).toBe(false)
    expect(reloads).toEqual([])
  })

  it('answers unknown and malformed paths without touching anything', async () => {
    expect((await call('POST', '/somewhere')).status).toBe(404)
    expect((await call('GET', '/somewhere')).status).toBe(404)
    expect((await call('DELETE', '/entry/author/author_1/extra')).status).toBe(404)
    expect((await call('DELETE', '/entry/author/%E0%A4%A')).status).toBe(400)
    expect(exists('.forgepress/content/author/author_1.ts')).toBe(true)
  })
})
