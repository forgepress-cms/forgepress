import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig } from '../config/resolve'
import type { ContentRow } from '../types/entry'
import type { ForgePressSchema } from '../types/schema'
import { Buffer } from 'node:buffer'
import { createMediaStore } from '../disk/media'
import { createSource } from '../disk/source'
import { createWriter } from '../disk/writer'
import { ENDPOINT, isCollectionName, isEntryId } from '../files/paths'
import { isAssetName, mediaType } from '../media'
import { validateSchema } from '../schema/validate'
import { isRecord } from '../utils/value'

export class EndpointError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'EndpointError'
    this.status = status
  }
}

function sameOrigin(request: IncomingMessage): boolean {
  const site = request.headers['sec-fetch-site']

  if (site !== undefined)
    return site === 'same-origin' || site === 'none'

  const { origin, host } = request.headers

  if (origin === undefined)
    return true

  try {
    return new URL(origin).host === host
  }
  catch {
    return false
  }
}

function missing(path: string): EndpointError {
  return new EndpointError(404, `there is no endpoint ${JSON.stringify(path)}`)
}

async function bytes(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of request)
    chunks.push(chunk as Buffer)

  return Buffer.concat(chunks)
}

async function body(request: IncomingMessage): Promise<unknown> {
  const text = (await bytes(request)).toString('utf8')

  try {
    return JSON.parse(text)
  }
  catch {
    throw new EndpointError(400, 'the request body is not valid JSON')
  }
}

function json(response: ServerResponse, payload: unknown): void {
  response.statusCode = 200
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(payload))
}

function done(response: ServerResponse): void {
  response.statusCode = 204
  response.end()
}

function decode(value: string, path: string): string {
  try {
    return decodeURIComponent(value)
  }
  catch {
    throw new EndpointError(400, `${JSON.stringify(path)} is not a valid path`)
  }
}

function segments(path: string, prefix: string, count: number): (string | undefined)[] {
  const found = path.slice(prefix.length).split('/').filter(Boolean).map(segment => decode(segment, path))

  if (found.length > count)
    throw missing(path)

  return found
}

function collectionName(name: string | undefined): string {
  if (name === undefined || !isCollectionName(name))
    throw new EndpointError(400, `${JSON.stringify(name ?? '')} is not a collection name`)

  return name
}

function entryId(id: unknown): string {
  if (typeof id !== 'string' || !isEntryId(id))
    throw new EndpointError(400, `${JSON.stringify(id ?? '')} is not an entry id`)

  return id
}

function entry(value: unknown): ContentRow {
  if (!isRecord(value))
    throw new EndpointError(400, 'an entry has to be an object')

  entryId(value.id)

  return value as ContentRow
}

async function media(config: ResolvedConfig, root: string, path: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const store = createMediaStore(root, config.media)

  if (request.method === 'GET')
    return json(response, await store.list())

  const name = decode(path.slice('/media/'.length), path)

  if (request.method === 'DELETE') {
    if (!isAssetName(name))
      throw new EndpointError(400, `${JSON.stringify(name)} is not an asset name`)

    await store.remove(name)

    return done(response)
  }

  if (!mediaType(name))
    throw new EndpointError(400, `${JSON.stringify(name)} is not a supported media file`)

  return json(response, await store.write({ name, data: await bytes(request) }))
}

async function read(config: ResolvedConfig, root: string, path: string, response: ServerResponse): Promise<void> {
  const source = createSource(root, config.paths, { unpublished: true })

  if (path === '/schema')
    return json(response, await source.schema())

  if (path.startsWith('/content/')) {
    const [collection = ''] = segments(path, '/content/', 1)
    const schema = await source.schema()

    return json(response, Object.hasOwn(schema.collections, collection) ? await source.list(collection) : [])
  }

  if (!path.startsWith('/entry/'))
    throw missing(path)

  const [collection = '', id = ''] = segments(path, '/entry/', 2)
  const schema = await source.schema()
  const row = Object.hasOwn(schema.collections, collection) && isEntryId(id) ? await source.entry(collection, id) : undefined

  if (row)
    return json(response, row)

  response.statusCode = 404
  response.end()
}

async function write(config: ResolvedConfig, root: string, path: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const writer = createWriter(root, config.paths, config.content)
  const removing = request.method === 'DELETE'

  if (path === '/schema' && !removing) {
    const schema = await body(request)
    const issues = validateSchema(schema)

    if (issues.length > 0)
      throw new EndpointError(400, `the schema is not valid:\n${issues.map(issue => issue.message).join('\n')}`)

    await writer.writeSchema(schema as ForgePressSchema)
  }
  else if (path.startsWith('/entry/')) {
    const [name, id] = segments(path, '/entry/', 2)
    const collection = collectionName(name)

    if (removing) {
      await writer.removeEntry(collection, entryId(id))
    }
    else {
      const row = entry(await body(request))

      if (row.id !== entryId(id))
        throw new EndpointError(400, `the entry id ${JSON.stringify(row.id)} doesn't match the path`)

      await writer.writeEntry(collection, row)
    }
  }
  else if (path.startsWith('/content/')) {
    const [name] = segments(path, '/content/', 1)
    const collection = collectionName(name)

    if (removing) {
      await writer.removeCollection(collection)
    }
    else {
      const rows = await body(request)

      if (!Array.isArray(rows))
        throw new EndpointError(400, 'the entries have to be a list')

      await writer.writeContent(collection, rows.map(entry))
    }
  }
  else {
    throw missing(path)
  }

  done(response)
}

export async function handle(config: ResolvedConfig, root: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!sameOrigin(request))
    throw new EndpointError(403, 'the dev endpoint only accepts requests from pages on its own origin')

  const path = (request.url ?? '').slice(ENDPOINT.length)

  if (path === '/media' || path.startsWith('/media/'))
    return media(config, root, path, request, response)

  if (request.method === 'GET')
    return read(config, root, path, response)

  return write(config, root, path, request, response)
}
