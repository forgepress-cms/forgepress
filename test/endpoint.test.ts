import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { UnpluginContextMeta } from 'unplugin'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
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

  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const fetch = globalThis.fetch

  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => fetch(`${origin}${path}`, init))
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
