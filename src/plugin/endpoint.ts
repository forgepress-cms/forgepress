import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig } from '../config/resolve'
import type { ContentRow } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import { Buffer } from 'node:buffer'
import { createMediaStore } from '../disk/media'
import { createSource } from '../disk/source'
import { createWriter } from '../disk/writer'
import { ENDPOINT, isEntryId } from '../files/paths'

async function bytes(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request)
    chunks.push(chunk as Buffer)

  return Buffer.concat(chunks)
}

async function body(request: IncomingMessage): Promise<unknown> {
  return JSON.parse((await bytes(request)).toString('utf8'))
}

function json(response: ServerResponse, payload: unknown): void {
  response.statusCode = 200
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(payload))
}

async function media(config: ResolvedConfig, root: string, path: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const store = createMediaStore(root, config.media)
  const name = decodeURIComponent(path.slice('/media/'.length))

  if (request.method === 'GET')
    return json(response, await store.list())

  if (request.method !== 'DELETE')
    return json(response, await store.write({ name, data: await bytes(request) }))

  await store.remove(name)

  response.statusCode = 204
  response.end()
}

function segments(path: string, prefix: string): string[] {
  return path.slice(prefix.length).split('/').filter(Boolean).map(decodeURIComponent)
}

async function read(config: ResolvedConfig, root: string, path: string, response: ServerResponse): Promise<void> {
  const source = createSource(root, config.paths, { unpublished: true })
  const schema = await source.schema()

  if (path === '/schema')
    return json(response, schema)

  if (path.startsWith('/content/')) {
    const [collection = ''] = segments(path, '/content/')

    return json(response, Object.hasOwn(schema.collections, collection) ? await source.list(collection) : [])
  }

  if (!path.startsWith('/entry/'))
    throw new Error(`unknown endpoint "${path}"`)

  const [collection = '', id = ''] = segments(path, '/entry/')
  const row = Object.hasOwn(schema.collections, collection) && isEntryId(id) ? await source.entry(collection, id) : undefined

  if (row)
    return json(response, row)

  response.statusCode = 404
  response.end()
}

export async function handle(config: ResolvedConfig, root: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const path = (request.url ?? '').slice(ENDPOINT.length)
  const writer = createWriter(root, config.paths, config.content)

  if (path === '/media' || path.startsWith('/media/'))
    return media(config, root, path, request, response)

  if (request.method === 'GET')
    return read(config, root, path, response)

  if (path === '/schema') {
    await writer.writeSchema(await body(request) as ForgePressSchema)
  }
  else if (path.startsWith('/entry/')) {
    const [collection, id] = segments(path, '/entry/')

    if (!collection || !id)
      throw new Error(`unknown endpoint "${path}"`)

    if (request.method === 'DELETE')
      await writer.removeEntry(collection, id)
    else
      await writer.writeEntry(collection, await body(request) as ContentRow)
  }
  else if (path.startsWith('/content/')) {
    const [collection] = segments(path, '/content/')

    if (!collection)
      throw new Error(`unknown endpoint "${path}"`)

    if (request.method === 'DELETE')
      await writer.removeCollection(collection)
    else
      await writer.writeContent(collection, await body(request) as ContentRow[])
  }
  else {
    throw new Error(`unknown endpoint "${path}"`)
  }

  response.statusCode = 204
  response.end()
}
