import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ResolvedConfig } from '../config/resolve'
import type { Entry } from '../entries/types'
import type { ContentIssue } from '../files/issues'
import type { ForgePressSchema } from '../schema/types'
import type { SchemaChangeset } from '../store/types'
import type { DevMigrations } from './migrations'
import { Buffer } from 'node:buffer'
import { diskFiles } from '../disk/files'
import { createMediaStore } from '../disk/media'
import { createWriter } from '../disk/writer'
import { ENDPOINT, ROUTES } from '../endpoint/routes'
import { createFileSource, readEntries } from '../files/content'
import { isCollectionName, isEntryId } from '../files/paths'
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

export interface DevState {
  migrations: DevMigrations
  issues: () => readonly ContentIssue[]
}

export interface OriginPolicy {
  accepts: (request: IncomingMessage) => boolean
  refusal: string
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

export const SAME_ORIGIN: OriginPolicy = {
  accepts: sameOrigin,
  refusal: 'the dev endpoint only accepts requests from pages on its own origin',
}

function missing(path: string): EndpointError {
  return new EndpointError(404, `there is no endpoint ${JSON.stringify(path)}`)
}

async function bytes(request: IncomingMessage): Promise<Buffer<ArrayBuffer>> {
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

function under(path: string, route: string): boolean {
  return path.startsWith(`${route}/`)
}

function segments(path: string, route: string, count: number): (string | undefined)[] {
  const found = path.slice(route.length + 1).split('/').filter(Boolean).map(segment => decode(segment, path))

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

function entry(value: unknown): Entry {
  if (!isRecord(value))
    throw new EndpointError(400, 'an entry has to be an object')

  entryId(value.id)

  return value as Entry
}

function schema(value: unknown): ForgePressSchema {
  const issues = validateSchema(value)

  if (issues.length > 0)
    throw new EndpointError(400, `the schema is not valid:\n${issues.map(issue => issue.message).join('\n')}`)

  return value as ForgePressSchema
}

function changeset(value: unknown): SchemaChangeset {
  if (!isRecord(value) || !Array.isArray(value.write) || !Array.isArray(value.collections))
    throw new EndpointError(400, 'a schema change needs "schema", "write" and "collections"')

  const write = value.write.map((item: unknown) => {
    if (!isRecord(item) || typeof item.collection !== 'string')
      throw new EndpointError(400, 'every entry of a schema change needs a "collection" and an "entry"')

    return { collection: collectionName(item.collection), entry: entry(item.entry) }
  })

  const collections = value.collections.map((name: unknown) => collectionName(typeof name === 'string' ? name : undefined))

  return { schema: schema(value.schema), write, collections }
}

async function media(config: ResolvedConfig, root: string, path: string, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const store = createMediaStore(root, config.media)

  if (request.method === 'GET') {
    json(response, await store.list())

    return false
  }

  const name = decode(path.slice(ROUTES.media.length + 1), path)

  if (request.method === 'DELETE') {
    if (!isAssetName(name))
      throw new EndpointError(400, `${JSON.stringify(name)} is not an asset name`)

    await store.remove(name)
    done(response)

    return true
  }

  if (!mediaType(name))
    throw new EndpointError(400, `${JSON.stringify(name)} is not a supported media file`)

  json(response, await store.write({ name, data: await bytes(request) }))

  return true
}

async function read(config: ResolvedConfig, root: string, path: string, response: ServerResponse, state: DevState): Promise<void> {
  const source = createFileSource(diskFiles(root), config.paths)

  if (path === ROUTES.schema)
    return json(response, await source.schema())

  if (path === ROUTES.content)
    return json(response, await readEntries(diskFiles(root), config.paths))

  if (path === ROUTES.issues)
    return json(response, state.issues())

  if (path === ROUTES.migration)
    return json(response, state.migrations.state())

  if (under(path, ROUTES.content)) {
    const [collection = ''] = segments(path, ROUTES.content, 1)
    const schema = await source.schema()

    return json(response, Object.hasOwn(schema.collections, collection) ? await source.list(collection) : [])
  }

  if (!under(path, ROUTES.entry))
    throw missing(path)

  const [collection = '', id = ''] = segments(path, ROUTES.entry, 2)
  const schema = await source.schema()
  const row = Object.hasOwn(schema.collections, collection) && isEntryId(id) ? await source.entry(collection, id) : undefined

  if (row)
    return json(response, row)

  response.statusCode = 404
  response.end()
}

async function write(config: ResolvedConfig, root: string, path: string, request: IncomingMessage, response: ServerResponse, state: DevState): Promise<boolean> {
  const writer = createWriter(root, config.paths, config.content)
  const removing = request.method === 'DELETE'

  if (path === ROUTES.migration && removing) {
    state.migrations.dismiss()
    done(response)

    return false
  }

  if (path === ROUTES.migration) {
    await state.migrations.apply(changeset(await body(request)))
  }
  else if (under(path, ROUTES.entry)) {
    const [name, id] = segments(path, ROUTES.entry, 2)
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
  else {
    throw missing(path)
  }

  done(response)

  return true
}

export async function handle(config: ResolvedConfig, root: string, request: IncomingMessage, response: ServerResponse, state: DevState, origins: OriginPolicy = SAME_ORIGIN): Promise<boolean> {
  if (!origins.accepts(request))
    throw new EndpointError(403, origins.refusal)

  const path = (request.url ?? '').slice(ENDPOINT.length)

  if (path === ROUTES.media || under(path, ROUTES.media))
    return media(config, root, path, request, response)

  if (request.method !== 'GET')
    return write(config, root, path, request, response, state)

  await read(config, root, path, response, state)

  return false
}
